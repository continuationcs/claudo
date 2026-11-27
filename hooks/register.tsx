// claudo: reads a local txt file and draws it inside the conversation, as
// comments in real code from the session's project, under Bash and Read rows.
// Nothing from the file reaches the model or the stored transcript: the file
// is read with $.fs and only the drawing of those rows changes. /claudo and
// the boss key "x" are dropped before they are sent.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type $ = EngineInterface

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

// Reads a whole file's bytes. Older Claude Code refuses any read of a file
// over 4 MiB, a range included, so a larger file is first split on disk into
// parts under that, each read whole, and joined back here.
async function readAll($: $, file: string): Promise<Uint8Array> {
  const { size } = await $.fs.stat(file)
  if (size < CHUNK) return fromBase64((await $.fs.read(file, { as: 'bytes' })).base64)
  const dir = `/tmp/.claudo-parts-${hash(file)}`
  const split = await $.process.run(
    ['/bin/sh', '-c', 'rm -rf "$1" && mkdir -p "$1" && split -b 3000000 "$2" "$1/p-" && ls "$1"', 'sh', dir, file],
    { timeoutMs: 120_000 },
  )
  if (split.exitCode !== 0) throw new Error(split.stderr.trim() || 'split failed')
  const parts = split.stdout.split('\n').filter(Boolean).sort()
  const buf = new Uint8Array(size)
  let off = 0
  try {
    for (const part of parts) {
      const bytes = fromBase64((await $.fs.read(`${dir}/${part}`, { as: 'bytes' })).base64)
      buf.set(bytes.subarray(0, Math.max(0, size - off)), off)
      off += bytes.length
    }
  } finally {
    await $.process.run(['rm', '-rf', dir]).catch(() => undefined)
  }
  if (off !== size) throw new Error(`read ${off} of ${size} bytes`)
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
    .catch(async err => {
      const message = String(err?.message ?? err)
      // the answer in the conversation says only "Error.": the detail goes to a
      // local file, which names the path and never the book's text
      await $.fs.write('/tmp/claudo-error.txt', `${new Date().toISOString()} ${file}\n${message}\n`).catch(() => {})
      await update($, errorA, () => message)
    })
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
    // the app drops a block's trailing blank line, which would change its height
    if (!chunk[0]?.trim() || !chunk[n - 1]?.trim()) continue
    if (chunk.filter(l => l.trim()).length >= n * 0.7) return { path: f, start: start + 1, lines: chunk }
  }
  const fits: number[] = []
  for (let at = 0; at + n <= FALLBACK.lines.length; at++) {
    if (FALLBACK.lines[at]!.trim() && FALLBACK.lines[at + n - 1]!.trim()) fits.push(at)
  }
  const at = fits.length ? pick(r, fits) : 0
  return { path: FALLBACK.path, start: FALLBACK.start + at, lines: FALLBACK.lines.slice(at, at + n) }
}

const mark = (p: string) => (/\.(py|rb|sh)$/.test(p) ? '#' : '//')
const indent = (l: string) => l.slice(0, l.length - l.trimStart().length)

// ------------------------------------------------------------------ a row's code

type Shown = { path: string; start: number; source: string }

// An opened block is always BLOCK_ROWS lines, none of them wrapping, so the
// "… +N lines" line under it stays put from page to page.
const BLOCK_ROWS = 14

// Columns a string takes: CJK and full-width characters count two.
const cols = (t: string) => {
  let n = 0
  for (const ch of t) n += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1
  return n
}

// Cuts a string into pieces no wider than `width` columns.
function cut(t: string, width: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const ch of t) {
    if (cur && cols(cur + ch) > width) {
      out.push(cur)
      cur = ''
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

// Cuts a line of code to `width` columns.
const clip = (t: string, width: number) => (cols(t) <= width ? t : cut(t, width)[0] ?? '')

// A page of the book: whole sentences, a sentence the reader cut in two
// (one over WRAP characters) put back together, filling at most NOTE_ROWS
// note lines of NOTE_COLS columns.
const NOTE_ROWS = 10
const NOTE_COLS = 50
// Only a piece the reader cut at exactly WRAP characters goes on into the
// next one; anything shorter (a title, a paragraph's end) stands alone.
const ends = (t: string) => t.length < WRAP || /[。！？!?…”’」』"]$/.test(t)

// The sentences [k, j) that make one whole sentence ending at j - 1.
function groupBefore(sents: string[], j: number) {
  let k = j - 1
  while (k > 0 && !ends(sents[k - 1]!) && j - k < 4) k--
  return k
}

function pageAt(sents: string[], pos: number) {
  const notes: string[] = []
  let rows = 0
  let j = pos
  while (j < sents.length) {
    let k = j + 1
    while (k < sents.length && !ends(sents[k - 1]!) && k - j < 4) k++
    const text = sents.slice(j, k).join('')
    const need = cut(text, NOTE_COLS).length
    if (notes.length && rows + need > NOTE_ROWS) break
    notes.push(text)
    rows += need
    j = k
  }
  return { notes, end: j }
}

// Where the page before the one at `pos` starts.
function pageBefore(sents: string[], pos: number) {
  let rows = 0
  let j = pos
  while (j > 0) {
    const k = groupBefore(sents, j)
    rows += cut(sents.slice(k, j).join(''), NOTE_COLS).length
    if (j < pos && rows > NOTE_ROWS) break
    j = k
  }
  return j
}

// Real code with the notes as comments between its lines: exactly
// BLOCK_ROWS lines, each well inside the code block's room. The width the
// surface reports runs wider than that room (a grouped row's block is
// narrower still), so stay at most 64 columns of code and 50 of a note.
async function codeWith($: $, r: () => number, notes: string[], width: number): Promise<Shown> {
  const room = Math.min(64, Math.max(24, width - 20))
  // each note becomes one or more lines, kept together
  const groups = notes.map(t => cut(t, Math.min(NOTE_COLS, room - 12)))
  const noteRows = groups.reduce((n, g) => n + g.length, 0)
  const codeRows = Math.max(2, BLOCK_ROWS - noteRows)
  const s = await snippet($, r, codeRows)
  const lines = s.lines.slice(0, codeRows)
  const slots = new Set<number>()
  while (slots.size < Math.min(groups.length, lines.length - 1)) slots.add(int(r, 1, lines.length - 1))
  const order = [...slots].sort((a, b) => a - b)
  const out: string[] = []
  let gi = 0
  const put = (lead: string) => {
    for (const piece of groups[gi++] ?? []) out.push(`${lead}${mark(s.path)} ${piece}`)
  }
  lines.forEach((code, i) => {
    if (order.includes(i)) put(clip(indent(code), 8))
    out.push(clip(code, room))
  })
  // what slots could not take goes before the last line, never after it
  const last = out.pop() ?? ''
  while (gi < groups.length) put(clip(indent(last), 8))
  out.push(last)
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

// A Bash or Read call made while reading is on gets a line under its row.
// There is one reading position: whichever row is opened shows the page there.
async function claim($: $, key: string) {
  try {
    if (!(await read($, inlineA)) || (await read($, bossA))) return
    const path = await read($, pathA)
    if (!path) return
    if (!books.get(path)) ensureBook($, path)
    if ((await read($, marksA))[key]) return
    await setMark($, path, key, [await read($, posA), 0])
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

// Forward to the page after the one shown, or back to the one before.
async function turn($: $, dir: 1 | -1) {
  const path = await read($, pathA)
  const sents = books.get(path)
  if (!path || !sents) return
  let pos = 0
  await update($, posA, p => {
    pos = dir === 1 ? Math.min(pageAt(sents, p).end, Math.max(0, sents.length - 1)) : pageBefore(sents, p)
    return pos
  })
  await $.store.set(`pos:${hash(path)}`, pos)
}

// Opening a row closes any other: one block open at a time.
async function toggleOpen($: $, key: string) {
  await update($, openA, m => (m[key] ? {} : { [key]: true }))
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
    await $.command.register({ name: 'claudo', description: 'claudo', argumentHint: '[b | n | on | off | file]', immediate: true })
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
      await claim($, e.tool_use_id)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // Under a Bash or Read row: one quiet line that opens the code (closing any
  // other row's); under the code, "… +N lines" turns forward and
  // "(ctrl+o to expand)" turns back. The size and place of both stay put.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const id = e.props.tool_use_id
    await read($, loadedA) // draw again once the book is read
    const at = (await read($, marksA))[id]
    const sents = books.get(await read($, pathA))
    if (!at || !sents?.length || e.props.isRunning || !(await read($, inlineA)) || (await read($, bossA))) return next(e)
    const pos = await read($, posA)
    // The terminal hands no clicks to a row: there the newest row is open by
    // itself, and /claudo n and /claudo b turn its pages.
    const marks = await read($, marksA)
    const isOpen = e.surface === 'terminal' ? Object.keys(marks).pop() === id : (await read($, openA))[id] === true
    const r0 = rng(parseInt(hash(id), 16))
    const n = int(r0, 2, 9)
    // the gutter, its gap and the row's indent take about 10 columns
    const width = (e.viewport?.columns ?? 100) - 10
    const shown = await codeWith($, rng(parseInt(hash(`${id}:${pos}`), 16)), pageAt(sents, pos).notes, width)
    const summary = e.props.tool === 'Read' ? `${n + 31} lines` : `${n} matches in ${shown.path.split('/').pop()}`
    const more = int(r0, 12, 60)
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {await next(e)}
        <Button key={`open-${id}`} plain onPress={() => void toggleOpen($, id)}>
          <Text dimColor>
            {'  ⎿  '}
            {summary}
            {isOpen ? '' : ' …'}
          </Text>
        </Button>
        {isOpen && <Code source={shown.source} path={shown.path} startLine={shown.start} wrap="truncate-end" />}
        {isOpen && (
          <Box flexDirection="row">
            <Button key={`more-${id}`} plain onPress={() => void turn($, 1)}>
              <Text dimColor>{`     … +${more} lines `}</Text>
            </Button>
            <Button key={`back-${id}`} plain onPress={() => void turn($, -1)}>
              <Text dimColor>(ctrl+o to expand)</Text>
            </Button>
          </Box>
        )}
      </Box>
    )
  })

  // /claudo <file> | n | b | on | off | (nothing: how far reading has got). In the
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
  if (/^(n|next|b|back)$/i.test(arg)) {
    await turn($, /^n/i.test(arg) ? 1 : -1)
    return progress($)
  }
  if (/^(off|on)$/i.test(arg)) {
    await setInline($, arg.toLowerCase() === 'on')
    return arg.toLowerCase() === 'on' ? 'On.' : 'Off.'
  }
  if (!arg) {
    const path = await read($, pathA)
    if (!path) return 'None.'
    return progress($)
  }
  await openBook($, arg)
  const error = await read($, errorA)
  return error ? 'Error.' : 'Ready.'
}

async function progress($: $): Promise<string> {
  const sents = books.get(await read($, pathA))
  const pct = sents ? ((await read($, posA)) * 100) / Math.max(1, sents.length) : 0
  const state = (await read($, inlineA)) ? '' : ' · off'
  return `${pct.toFixed(1)}%${state}`
}
