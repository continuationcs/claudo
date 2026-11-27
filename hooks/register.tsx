// claudo: a pane titled "Trace" that reads a local txt file and draws it as
// session output (replies, Read / Update / Bash rows) mixed with real code
// from a local repository. Nothing from the file reaches the model: the file
// is read with $.fs and drawn in the pane only.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type $ = EngineInterface

const PANE = 'claudo'
const TITLE = 'Trace'
const PER_PAGE = 8 // sentences per page, always exactly this many but at the end
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
// Module variables: a reload drops them and the pane loads again.

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

// ------------------------------------------------------------------ a page

type Block =
  | { kind: 'prose'; lines: string[] }
  | { kind: 'read'; path: string; start: number; source: string }
  | { kind: 'update'; path: string; diff: string; adds: number }
  | { kind: 'bash'; cmd: string; lines: string[] }

const CMDS = ['pnpm vitest run --reporter=dot', 'pnpm tsc --noEmit', 'git diff --stat', 'pnpm lint', 'rg -n "sessionId" src']

async function readBlock($: $, r: () => number, sents: string[]): Promise<Block> {
  const s = await snippet($, r, int(r, 7, 11))
  const slots = new Set<number>()
  while (slots.size < Math.min(sents.length, s.lines.length - 1)) slots.add(int(r, 1, s.lines.length - 1))
  const order = [...slots].sort((a, b) => a - b)
  const out: string[] = []
  let si = 0
  s.lines.forEach((code, i) => {
    if (order[si] === i) out.push(`${indent(code)}${mark(s.path)} ${sents[si++]}`)
    out.push(code)
  })
  return { kind: 'read', path: s.path, start: s.start, source: out.join('\n') }
}

async function updateBlock($: $, r: () => number, sents: string[]): Promise<Block> {
  const s = await snippet($, r, int(r, 6, 9))
  const cut = int(r, 2, s.lines.length - 2)
  const body: string[] = []
  s.lines.forEach((code, i) => {
    if (i === cut) {
      body.push('-' + code)
      for (const t of sents) body.push(`+${indent(code)}${mark(s.path)} ${t}`)
      body.push('+' + code)
    } else body.push(' ' + code)
  })
  const oldN = s.lines.length
  const newN = oldN + sents.length
  const diff = `@@ -${s.start},${oldN} +${s.start},${newN} @@\n${body.join('\n')}`
  return { kind: 'update', path: s.path, diff, adds: sents.length + 1 }
}

async function buildPage($: $, sents: string[], pos: number) {
  const r = rng(pos * 2654435761 + 7)
  const blocks: Block[] = []
  let i = pos
  let budget = PER_PAGE
  while (budget > 0 && i < sents.length) {
    const roll = r()
    const kind = roll < 0.4 ? 'prose' : roll < 0.7 ? 'read' : roll < 0.9 ? 'update' : 'bash'
    let take = kind === 'prose' ? int(r, 2, 3) : kind === 'read' ? int(r, 1, 3) : int(r, 1, 2)
    take = Math.min(take, budget, sents.length - i)
    const part = sents.slice(i, i + take)
    if (kind === 'prose') blocks.push({ kind, lines: part })
    else if (kind === 'read') blocks.push(await readBlock($, r, part))
    else if (kind === 'update') blocks.push(await updateBlock($, r, part))
    else blocks.push({ kind, cmd: pick(r, CMDS), lines: part })
    i += take
    budget -= take
  }
  return { blocks, end: i, secs: int(r, 8, 95), tokens: `${int(r, 1, 9)}.${int(r, 0, 9)}k` }
}

async function bossPage($: $, seed: number): Promise<Block[]> {
  const r = rng(seed)
  const s = await snippet($, r, 12)
  const dir = s.path.split('/').slice(0, -1).join('/') || 'src'
  return [
    { kind: 'read', path: s.path, start: s.start, source: s.lines.join('\n') },
    { kind: 'bash', cmd: 'pnpm vitest run --reporter=dot', lines: ['·'.repeat(int(r, 40, 60)), `Test Files  ${int(r, 30, 60)} passed`, `     Tests  ${int(r, 300, 600)} passed`] },
    { kind: 'prose', lines: [`测试全部通过。接下来我看一下 ${dir} 里的调用方，确认没有其它地方依赖旧的行为。`] },
  ]
}

// ------------------------------------------------------------------ progress

async function remember($: $, path: string, pos: number) {
  await $.store.set(`pos:${hash(path)}`, pos)
}

async function openBook($: $, raw: string) {
  const path = await expand($, raw)
  await $.store.set('path', path)
  const saved = Number((await $.store.get(`pos:${hash(path)}`)) ?? 0)
  const marks = ((await $.store.get(`marks:${hash(path)}`)) ?? {}) as Record<string, [number, number]>
  await update($, posA, () => saved)
  await update($, marksA, () => marks)
  await update($, pathA, () => path)
  await update($, errorA, () => '')
  ensureBook($, path)
}

// Inline mode: a Bash or Read call claims the next few sentences when it is
// made. Under its row the pane draws one quiet summary line; a click on it
// opens real code with the sentences as comments. Only the drawing changes:
// the result as stored, and what the model reads, are untouched.

async function claim($: $, key: string, count: number) {
  try {
    await claimNow($, key, count)
  } catch {
    // never let reading get in the way of a tool call or a reply
  }
}

async function claimNow($: $, key: string, count: number) {
  if (!(await read($, inlineA)) || (await read($, bossA))) return
  const path = await read($, pathA)
  const sents = books.get(path)
  if (!path) return
  if (!sents) return ensureBook($, path)
  if ((await read($, marksA))[key]) return
  let start = 0
  await update($, posA, p => {
    start = Math.min(p, sents.length)
    return Math.min(p + count, sents.length)
  })
  if (start >= sents.length) return
  let kept: Record<string, [number, number]> = {}
  await update($, marksA, m => {
    const entries = Object.entries({ ...m, [key]: [start, count] as [number, number] })
    kept = Object.fromEntries(entries.slice(-MAX_MARKS))
    return kept
  })
  await remember($, path, start + count)
  await $.store.set(`marks:${hash(path)}`, kept)
}

async function turn($: $, delta: number | 'boss' | 'close' | 'inline') {
  if (delta === 'boss') return update($, bossA, b => !b)
  if (delta === 'inline') {
    let on = false
    await update($, inlineA, b => (on = !b))
    return $.store.set('inline', on)
  }
  const path = await read($, pathA)
  if (delta === 'close') {
    await $.store.delete('path')
    return update($, pathA, () => '')
  }
  const total = books.get(path)?.length ?? 0
  let next = 0
  await update($, posA, p => {
    next = Math.max(0, Math.min(p + delta, Math.max(0, total - 1)))
    return next
  })
  await update($, bossA, () => false)
  await remember($, path, next)
}

// ------------------------------------------------------------------ hooks

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'claudo', description: 'Open the trace pane' })
    repoFiles = undefined // the session may work in another project now
    const saved = (await $.store.get('path')) as string | undefined
    if (saved && !(await read($, pathA))) {
      const pos = Number((await $.store.get(`pos:${hash(saved)}`)) ?? 0)
      const marks = ((await $.store.get(`marks:${hash(saved)}`)) ?? {}) as Record<string, [number, number]>
      await update($, posA, () => pos)
      await update($, marksA, () => marks)
      await update($, pathA, () => saved)
    }
    // a reload empties the module's cache: read the book again, pane open or not
    const path = await read($, pathA)
    if (path) ensureBook($, path)
    // inline is on unless it was turned off
    const inline = (await $.store.get('inline')) !== false
    await update($, inlineA, () => inline)
    return next(e)
  })

  // a Bash or Read call claims a sentence or two before it runs
  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Bash' || e.tool === 'Read') {
      await claim($, e.tool_use_id, 1 + (hash(e.tool_use_id).charCodeAt(0) % 2))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const id = e.props.tool_use_id
    const claimed = (await read($, marksA))[id]
    const sents = books.get(await read($, pathA))
    if (!claimed || !sents || e.props.isRunning || !(await read($, inlineA)) || (await read($, bossA))) return next(e)
    const part = sents.slice(claimed[0], claimed[0] + claimed[1])
    if (!part.length) return next(e)
    const isOpen = (await read($, openA))[id] === true
    const r = rng(parseInt(hash(id), 16))
    const block = await readBlock($, r, part)
    if (block.kind !== 'read') return next(e)
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const n = int(r, 2, 9)
    const summary = e.props.tool === 'Read' ? `${n + 31} lines` : `${n} matches in ${block.path.split('/').pop()}`
    const toggle = () => void update($, openA, m => ({ ...m, [id]: !m[id] }))
    return (
      <Box flexDirection="column">
        {await next(e)}
        <Button key={`open-${id}`} plain onPress={toggle}>
          <Text dimColor>
            {'  ⎿  '}
            {summary}
            {isOpen ? '' : ' …'}
          </Text>
        </Button>
        {isOpen && <Code source={block.source} path={block.path} startLine={block.start} wrap="truncate-end" />}
      </Box>
    )
  })

  // Boss key from the message box: a prompt of just "x" toggles boss mode and
  // is dropped, so it never reaches the model or the transcript.
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta || e.text.trim().toLowerCase() !== 'x') return next(e)
    await turn($, 'boss')
    return { drop: 'Nothing to send.' }
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'claudo' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input, Code } = $.ui.resolve(e)
    const path = await read($, pathA)
    const pos = await read($, posA)
    const boss = await read($, bossA)
    await read($, loadedA) // redraw once a load ends
    const error = await read($, errorA)
    const inline = await read($, inlineA)

    // Everything is a mouse target: a line of text turns to the next page, the
    // "Cogitated" part of the footer to the previous one, the token count toggles
    // boss mode, the percentage turns forward too. In boss mode a line does nothing.
    const fwd = () => void (boss ? undefined : turn($, PER_PAGE))
    const line = (key: string, children: unknown) => (
      <Button key={key} plain onPress={fwd}>
        {children as string}
      </Button>
    )
    const footer = (pct: string, secs: number, tokens: string) => (
      <Box flexDirection="row" marginTop={1}>
        <Button key="prev" plain onPress={() => void turn($, -PER_PAGE)}>
          <Text dimColor>✻ Cogitated for {secs}s</Text>
        </Button>
        <Text dimColor> · </Text>
        <Button key="boss" plain onPress={() => void turn($, 'boss')}>
          <Text dimColor>↓ {tokens} tokens</Text>
        </Button>
        <Text dimColor> · </Text>
        <Button key="next" plain onPress={() => void turn($, PER_PAGE)}>
          <Text dimColor>{pct}</Text>
        </Button>
        <Text dimColor>  </Text>
        <Button key="inline" plain label={inline ? '⇡' : '⇣'} onPress={() => void turn($, 'inline')} />
      </Box>
    )

    if (!path) {
      return (
        <Box flexDirection="column">
          <Text dimColor>Attach a trace source.</Text>
          <Input key="file" placeholder="~/path/to/session.log" submitLabel="Attach" onSubmit={v => void openBook($, v)} />
        </Box>
      )
    }

    if (error) {
      return (
        <Box flexDirection="column">
          <Text color="red">⏺ Error: {error}</Text>
          <Button key="reset" plain label="Choose another source" onPress={() => void turn($, 'close')} />
        </Box>
      )
    }

    const sents = books.get(path)
    if (!sents) {
      ensureBook($, path)
      return <Text dimColor>✻ Thinking…</Text>
    }

    const page = boss
      ? { blocks: await bossPage($, pos + 99), end: pos, secs: 41, tokens: '3.2k' }
      : await buildPage($, sents, pos)
    const pct = `${((page.end * 100) / Math.max(1, sents.length)).toFixed(1)}%`

    return (
      <Box flexDirection="column">
        {page.blocks.map((b, k) => {
          if (b.kind === 'prose')
            return (
              <Box key={`p${k}`} flexDirection="column" marginTop={1}>
                {b.lines.map((l, j) =>
                  line(
                    `p${k}-${j}`,
                    <Text>
                      {j === 0 ? '⏺ ' : '  '}
                      {l}
                    </Text>,
                  ),
                )}
              </Box>
            )
          if (b.kind === 'read')
            return (
              <Box key={`r${k}`} flexDirection="column" marginTop={1}>
                {line(
                  `r${k}`,
                  <Text>
                    <Text color="green">⏺ </Text>
                    <Text bold>Read</Text>({b.path})
                  </Text>,
                )}
                <Code source={b.source} path={b.path} startLine={b.start} wrap="truncate-end" />
              </Box>
            )
          if (b.kind === 'update')
            return (
              <Box key={`u${k}`} flexDirection="column" marginTop={1}>
                {line(
                  `u${k}`,
                  <Text>
                    <Text color="green">⏺ </Text>
                    <Text bold>Update</Text>({b.path})
                  </Text>,
                )}
                {line(
                  `u${k}-s`,
                  <Text dimColor>
                    {'  ⎿  '}Updated {b.path} with {b.adds} additions and 1 removal
                  </Text>,
                )}
                <Code source={b.diff} path={b.path} format="diff" wrap="truncate-end" />
              </Box>
            )
          return (
            <Box key={`b${k}`} flexDirection="column" marginTop={1}>
              {line(
                `b${k}`,
                <Text>
                  <Text color="green">⏺ </Text>
                  <Text bold>Bash</Text>({b.cmd})
                </Text>,
              )}
              {b.lines.map((l, j) =>
                line(
                  `b${k}-${j}`,
                  <Text dimColor>
                    {j === 0 ? '  ⎿  ' : '     '}
                    {l}
                  </Text>,
                ),
              )}
            </Box>
          )
        })}
        {footer(pct, page.secs, page.tokens)}
      </Box>
    )
  })
}
