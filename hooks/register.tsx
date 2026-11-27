// claudo: reads a local txt file and draws it inside the conversation, as
// comments in real code from the session's project, under Bash and Read rows.
// Nothing from the file reaches the model or the stored transcript: the file
// is read with $.fs and only the drawing of those rows changes. /claudo and
// the boss key "x" are dropped before they are sent.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type $ = EngineInterface

const ROW_PAGE = 4 // sentences a click on "+N lines" turns to
const WRAP = 56
const CHUNK = 4 * 1024 * 1024
const SRC = /\.(ts|tsx|js|jsx|mjs|py|rs|go|java|kt|swift|rb|php|c|cc|cpp|h|hpp|cs|scala|vue|svelte|sh)$/
const SKIP = /(node_modules|\/dist\/|\/build\/|\.min\.|\.d\.ts$|\/vendor\/|\/target\/|\/\.[^/]+\/|\/generated\/|\.pb\.)/

const pathA = atom({ plugin: 'claudo', key: 'path' } as const, '')
const posA = atom({ plugin: 'claudo', key: 'pos' } as const, 0)
const bossA = atom({ plugin: 'claudo', key: 'boss' } as const, false)
const loadedA = atom({ plugin: 'claudo', key: 'loaded' } as const, 0)
const errorA = atom({ plugin: 'claudo', key: 'error' } as const, '')
const inlineA = atom({ plugin: 'claudo', key: 'inline' } as const, true)
const marksA = atom({ plugin: 'claudo', key: 'marks' } as const, {} as Record<string, [number, number]>)
const openA = atom({ plugin: 'claudo', key: 'open' } as const, {} as Record<string, boolean>)
const MAX_MARKS = 400

// ------------------------------------------------------------------ helpers

function rng(seed: number) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(16)
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let o = 0
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]!) << 18) |
      (B64.indexOf(clean[i + 1] ?? 'A') << 12) |
      ((i + 2 < clean.length ? B64.indexOf(clean[i + 2]!) : 0) << 6) |
      (i + 3 < clean.length ? B64.indexOf(clean[i + 3]!) : 0)
    out[o++] = (n >> 16) & 255
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255
    if (i + 3 < clean.length) out[o++] = n & 255
  }
  return out.subarray(0, o)
}

function wrap(s: string, width: number): string[] {
  const out: string[] = []
  for (let i = 0; i < s.length; i += width) out.push(s.slice(i, i + width))
  return out
}

function toSentences(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const para = raw.replace(/[　\s]+/g, ' ').trim()
    if (!para) continue
    const parts = para.match(/.+?(?:[。！？!?…]+[”’」』"]?|$)/g) ?? [para]
    let buf = ''
    for (const p of parts) {
      buf += p.trim()
      if (buf.length >= 12) {
        out.push(...wrap(buf, WRAP))
        buf = ''
      }
    }
    if (buf) {
      const last = out[out.length - 1]
      if (last !== undefined && last.length + buf.length <= WRAP) out[out.length - 1] = last + buf
      else out.push(buf)
    }
  }
  return out
}

// ------------------------------------------------------------------ loading
// Module variables: a reload drops them and the book is read again.

let home = ''
const books = new Map<string, string[]>()
const loading = new Map<string, Promise<void>>()
let repoFiles: { root: string; files: string[] } | undefined
const fileCache = new Map<string, string[]>()

async function getHome($: $) {
  if (!home) home = (await $.process.run(['/bin/sh', '-c', 'printf %s "$HOME"'])).stdout
  return home
}

async function expand($: $, p: string) {
  p = p.trim().replace(/^["']|["']$/g, '')
  return p.startsWith('~') ? (await getHome($)) + p.slice(1) : p
}

async function readAll($: $, file: string): Promise<Uint8Array> {
  const { size } = await $.fs.stat(file)
  const buf = new Uint8Array(size)
  for (let off = 0; off < size; off += CHUNK) {
    const { base64 } = await $.fs.read(file, { as: 'bytes', offset: off, length: Math.min(CHUNK, size - off) })
    buf.set(fromBase64(base64), off)
  }
  return buf
}

function looksUtf8(bytes: Uint8Array) {
  const head = new TextDecoder('utf-8').decode(bytes.subarray(0, 65536))
  // a cut character at the very end is fine; anything earlier is not UTF-8
  return !head.slice(0, -4).includes('�')
}

async function loadBook($: $, file: string) {
  let bytes = await readAll($, file)
  if (!looksUtf8(bytes)) {
    const out = `/tmp/.claudo-${hash(file)}.txt`
    const r = await $.process.run(
      ['/bin/sh', '-c', 'iconv -c -f GB18030 -t UTF-8 "$1" > "$2"', 'sh', file, out],
      { timeoutMs: 120_000 },
    )
    if (r.exitCode !== 0) throw new Error(r.stderr.trim() || 'iconv failed')
    bytes = await readAll($, out)
  }
  let text = new TextDecoder('utf-8').decode(bytes)
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  books.set(file, toSentences(text))
}

function ensureBook($: $, file: string) {
  if (books.has(file) || loading.has(file)) return
  const job = loadBook($, file)
    .then(() => update($, errorA, () => ''))
    .catch(err => update($, errorA, () => String(err?.message ?? err)))
    .finally(() => {
      loading.delete(file)
      void update($, loadedA, n => n + 1)
    })
  loading.set(file, job.then(() => undefined))
}

// Code comes from the project the session works in: its git repository's
// tracked files, or, outside a repository, the source files under the folder.
async function ensureRepo($: $) {
  if (repoFiles) return repoFiles
  let root = ''
  let files: string[] = []
  try {
    const top = await $.process.run(['git', 'rev-parse', '--show-toplevel'])
    if (top.exitCode === 0 && top.stdout.trim()) {
      root = top.stdout.trim()
      files = (await $.process.run(['git', '-C', root, 'ls-files'])).stdout.split('\n')
    } else {
      root = (await $.process.run(['/bin/pwd'])).stdout.trim()
      const found = await $.process.run([
        'find', '.', '-maxdepth', '6', '-type', 'f', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.*/*',
      ])
      files = found.stdout.split('\n').map(f => f.replace(/^\.\//, ''))
    }
  } catch {
    files = []
  }
  files = files.filter(f => SRC.test(f) && !SKIP.test('/' + f)).slice(0, 20000)
  repoFiles = { root, files }
  return repoFiles
}

// Used where the project holds no source code to borrow from.
const FALLBACK: Snip = {
  path: 'src/sync/worker.ts',
  start: 41,
  lines: [
    'export async function drain(queue: Queue, opts: DrainOptions = {}) {',
    '  const limit = opts.limit ?? 50',
    '  const started = Date.now()',
    '  let handled = 0',
    '',
    '  while (handled < limit) {',
    '    const job = await queue.take({ timeoutMs: opts.timeoutMs ?? 2_000 })',
    '    if (!job) break',
    '',
    '    try {',
    '      await runJob(job)',
    '      await queue.ack(job.id)',
    '    } catch (err) {',
    '      const attempts = (job.attempts ?? 0) + 1',
    '      if (attempts >= MAX_ATTEMPTS) await queue.deadLetter(job.id, String(err))',
    '      else await queue.retry(job.id, backoff(attempts))',
    '    }',
    '    handled++',
    '  }',
    '',
    '  metrics.timing("worker.drain", Date.now() - started, { handled })',
    '  return handled',
    '}',
  ],
}

type Snip = { path: string; start: number; lines: string[] }

async function snippet($: $, r: () => number, n: number): Promise<Snip> {
  const { root, files } = await ensureRepo($)
  for (let tries = 0; tries < 12 && files.length; tries++) {
    const f = pick(r, files)
    let lines = fileCache.get(f)
    if (!lines) {
      try {
        lines = (await $.fs.read(`${root}/${f}`)).split('\n').map(l => l.slice(0, 100))
      } catch {
        lines = []
      }
      fileCache.set(f, lines)
    }
    if (lines.length < n + 5) continue
    const start = int(r, 0, lines.length - n - 1)
    const chunk = lines.slice(start, start + n)
    if (chunk.filter(l => l.trim()).length >= n * 0.7) return { path: f, start: start + 1, lines: chunk }
  }
  const at = int(r, 0, Math.max(0, FALLBACK.lines.length - n))
  return { path: FALLBACK.path, start: FALLBACK.start + at, lines: FALLBACK.lines.slice(at, at + n) }
}

const mark = (p: string) => (/\.(py|rb|sh)$/.test(p) ? '#' : '//')
const indent = (l: string) => l.slice(0, l.length - l.trimStart().length)

// ------------------------------------------------------------------ a row's code

type Shown = { path: string; start: number; source: string }

// Real code with the sentences as comments between its lines.
async function codeWith($: $, r: () => number, sents: string[]): Promise<Shown> {
  const s = await snippet($, r, Math.max(int(r, 7, 11), sents.length + 4))
  const slots = new Set<number>()
  while (slots.size < Math.min(sents.length, s.lines.length - 1)) slots.add(int(r, 1, s.lines.length - 1))
  const order = [...slots].sort((a, b) => a - b)
  const out: string[] = []
  let si = 0
  s.lines.forEach((code, i) => {
    if (order[si] === i) out.push(`${indent(code)}${mark(s.path)} ${sents[si++]}`)
    out.push(code)
  })
  while (si < sents.length) out.push(`${mark(s.path)} ${sents[si++]}`)
  return { path: s.path, start: s.start, source: out.join('\n') }
}

// ------------------------------------------------------------------ progress

type Marks = Record<string, [number, number]>

async function saveMarks($: $, path: string, marks: Marks) {
  await $.store.set(`marks:${hash(path)}`, marks)
}

async function openBook($: $, raw: string) {
  const path = await expand($, raw)
  await $.store.set('path', path)
  const saved = Number((await $.store.get(`pos:${hash(path)}`)) ?? 0)
  const marks = ((await $.store.get(`marks:${hash(path)}`)) ?? {}) as Marks
  await update($, posA, () => saved)
  await update($, marksA, () => marks)
  await update($, pathA, () => path)
  await update($, errorA, () => '')
  ensureBook($, path)
  await loading.get(path)
  return path
}

// A Bash or Read call claims the next sentence or two when it is made.
async function claim($: $, key: string, count: number) {
  try {
    if (!(await read($, inlineA)) || (await read($, bossA))) return
    const path = await read($, pathA)
    if (!path) return
    const sents = books.get(path)
    if (!sents) return ensureBook($, path)
    if ((await read($, marksA))[key]) return
    let start = 0
    await update($, posA, p => {
      start = Math.min(p, sents.length)
      return Math.min(p + count, sents.length)
    })
    if (start >= sents.length) return
    await setMark($, path, key, [start, count])
    await $.store.set(`pos:${hash(path)}`, Math.min(start + count, sents.length))
  } catch {
    // never let reading get in the way of a tool call
  }
}

async function setMark($: $, path: string, key: string, range: [number, number]) {
  let kept: Marks = {}
  await update($, marksA, m => {
    const rest = { ...m }
    delete rest[key]
    kept = Object.fromEntries(Object.entries({ ...rest, [key]: range }).slice(-MAX_MARKS))
    return kept
  })
  await saveMarks($, path, kept)
}

// A row turns its own page: forward to the sentences after the ones it shows
// (and reading progress follows), or back to the ones before.
async function turnRow($: $, key: string, dir: 1 | -1) {
  const path = await read($, pathA)
  const sents = books.get(path)
  const at = (await read($, marksA))[key]
  if (!path || !sents || !at) return
  const [start, count] = at
  if (dir === 1) {
    const from = start + count
    if (from >= sents.length) return
    const n = Math.min(ROW_PAGE, sents.length - from)
    await setMark($, path, key, [from, n])
    let pos = 0
    await update($, posA, p => (pos = Math.max(p, from + n)))
    await $.store.set(`pos:${hash(path)}`, pos)
  } else {
    if (start <= 0) return
    const from = Math.max(0, start - ROW_PAGE)
    await setMark($, path, key, [from, start - from])
  }
}

async function toggleBoss($: $) {
  await update($, bossA, b => !b)
}

async function setInline($: $, on: boolean) {
  await update($, inlineA, () => on)
  await $.store.set('inline', on)
}

// ------------------------------------------------------------------ hooks

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'claudo', description: 'Trace view', argumentHint: '[file | on | off]', immediate: true })
    repoFiles = undefined // the session may work in another project now
    const saved = (await $.store.get('path')) as string | undefined
    if (saved && !(await read($, pathA))) {
      const pos = Number((await $.store.get(`pos:${hash(saved)}`)) ?? 0)
      const marks = ((await $.store.get(`marks:${hash(saved)}`)) ?? {}) as Marks
      await update($, posA, () => pos)
      await update($, marksA, () => marks)
      await update($, pathA, () => saved)
    }
    // a reload empties the module's cache: read the book again
    const path = await read($, pathA)
    if (path) ensureBook($, path)
    // inline is on unless it was turned off
    const inline = (await $.store.get('inline')) !== false
    await update($, inlineA, () => inline)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Bash' || e.tool === 'Read') {
      await claim($, e.tool_use_id, 1 + (hash(e.tool_use_id).charCodeAt(0) % 2))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // Under a Bash or Read row: one quiet line that opens the code; under the
  // code, "… +N lines" turns forward and "(ctrl+o to expand)" turns back.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const id = e.props.tool_use_id
    await read($, loadedA) // draw again once the book is read
    const at = (await read($, marksA))[id]
    const sents = books.get(await read($, pathA))
    if (!at || !sents || e.props.isRunning || !(await read($, inlineA)) || (await read($, bossA))) return next(e)
    const part = sents.slice(at[0], at[0] + at[1])
    if (!part.length) return next(e)
    const isOpen = (await read($, openA))[id] === true
    const r0 = rng(parseInt(hash(id), 16))
    const n = int(r0, 2, 9)
    const shown = await codeWith($, rng(parseInt(hash(`${id}:${at[0]}`), 16)), part)
    const summary = e.props.tool === 'Read' ? `${n + 31} lines` : `${n} matches in ${shown.path.split('/').pop()}`
    const more = int(r0, 12, 60)
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {await next(e)}
        <Button key={`open-${id}`} plain onPress={() => void update($, openA, m => ({ ...m, [id]: !m[id] }))}>
          <Text dimColor>
            {'  ⎿  '}
            {summary}
            {isOpen ? '' : ' …'}
          </Text>
        </Button>
        {isOpen && <Code source={shown.source} path={shown.path} startLine={shown.start} wrap="truncate-end" />}
        {isOpen && (
          <Box flexDirection="row">
            <Button key={`more-${id}`} plain onPress={() => void turnRow($, id, 1)}>
              <Text dimColor>{`     … +${more} lines `}</Text>
            </Button>
            <Button key={`back-${id}`} plain onPress={() => void turnRow($, id, -1)}>
              <Text dimColor>(ctrl+o to expand)</Text>
            </Button>
          </Box>
        )}
      </Box>
    )
  })

  // /claudo <file> | on | off | (nothing: how far reading has got). In the
  // desktop app the command line and its answer are recorded in the
  // conversation, so the answer never names the file: "Ready.", "On.", "Off.",
  // "12.3%". (Each action is safe to run twice: prompt.submit handles it too.)
  // The first hook hands the run on with its arguments blanked, so the
  // recorded line reads just "/claudo"; the second acts on what was typed.
  let typed: string | undefined
  on('command.run', { command: 'claudo' }, async ($, e, next) => {
    typed = e.args
    try {
      return await next({ ...e, args: '' })
    } finally {
      typed = undefined
    }
  })
  on('command.run', { command: 'claudo' }, async ($, e) => ({ text: await runClaudo($, typed ?? e.args) }))

  // "x" alone toggles boss mode. Both are dropped before they are sent.
  on('prompt.submit', async ($, e, next) => {
    if (e.isMeta) return next(e)
    if (e.command?.name === 'claudo') return { drop: await runClaudo($, e.command.args) }
    if (e.command || e.text.trim().toLowerCase() !== 'x') return next(e)
    await toggleBoss($)
    return { drop: 'Nothing to send.' }
  }).catch(($, e, next) => next(e))
}

async function runClaudo($: $, args: string): Promise<string> {
  const arg = args.trim()
  if (/^(off|on)$/i.test(arg)) {
    await setInline($, arg.toLowerCase() === 'on')
    return arg.toLowerCase() === 'on' ? 'On.' : 'Off.'
  }
  if (!arg) {
    const path = await read($, pathA)
    if (!path) return 'None.'
    const sents = books.get(path)
    const pct = sents ? ((await read($, posA)) * 100) / Math.max(1, sents.length) : 0
    const state = (await read($, inlineA)) ? '' : ' · off'
    return `${pct.toFixed(1)}%${state}`
  }
  await openBook($, arg)
  const error = await read($, errorA)
  return error ? 'Error.' : 'Ready.'
}
