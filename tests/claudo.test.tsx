import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'

// "第一章 开端" then 29 sentences, as UTF-8 and as GB18030
const UTF8 = '56ys5LiA56ugIOW8gOerrwoK44CA44CA56ysMeWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDLlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwz5Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysNOWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDXlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKw25Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysN+WPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDjlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKw55Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMTDlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwxMeWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDEy5Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMTPlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwxNOWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDE15Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMTblj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwxN+WPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDE45Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMTnlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwyMOWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDIx5Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMjLlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwyM+WPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDI05Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMjXlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwyNuWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDI35Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMjjlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwyOeWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAggo='
const GBK = 'tdrSu9XCIL+qtssKCqGhoaG12jG+5KOst+e007PHw8XN4r7tvfjAtKGjtdoyvuSjrLfntNOzx8PFzeK+7b34wLSho7XaM77ko6y357TTs8fDxc3ivu29+MC0oaO12jS+5KOst+e007PHw8XN4r7tvfjAtKGjtdo1vuSjrLfntNOzx8PFzeK+7b34wLSho7XaNr7ko6y357TTs8fDxc3ivu29+MC0oaO12je+5KOst+e007PHw8XN4r7tvfjAtKGjtdo4vuSjrLfntNOzx8PFzeK+7b34wLSho7XaOb7ko6y357TTs8fDxc3ivu29+MC0oaO12jEwvuSjrLfntNOzx8PFzeK+7b34wLSho7XaMTG+5KOst+e007PHw8XN4r7tvfjAtKGjtdoxMr7ko6y357TTs8fDxc3ivu29+MC0oaO12jEzvuSjrLfntNOzx8PFzeK+7b34wLSho7XaMTS+5KOst+e007PHw8XN4r7tvfjAtKGjtdoxNb7ko6y357TTs8fDxc3ivu29+MC0oaO12jE2vuSjrLfntNOzx8PFzeK+7b34wLSho7XaMTe+5KOst+e007PHw8XN4r7tvfjAtKGjtdoxOL7ko6y357TTs8fDxc3ivu29+MC0oaO12jE5vuSjrLfntNOzx8PFzeK+7b34wLSho7XaMjC+5KOst+e007PHw8XN4r7tvfjAtKGjtdoyMb7ko6y357TTs8fDxc3ivu29+MC0oaO12jIyvuSjrLfntNOzx8PFzeK+7b34wLSho7XaMjO+5KOst+e007PHw8XN4r7tvfjAtKGjtdoyNL7ko6y357TTs8fDxc3ivu29+MC0oaO12jI1vuSjrLfntNOzx8PFzeK+7b34wLSho7XaMja+5KOst+e007PHw8XN4r7tvfjAtKGjtdoyN77ko6y357TTs8fDxc3ivu29+MC0oaO12jI4vuSjrLfntNOzx8PFzeK+7b34wLSho7XaMjm+5KOst+e007PHw8XN4r7tvfjAtKGjCg=='
const SIZE: Record<string, number> = { '/h/u.txt': 1118, '/h/g.txt': 763 }

const CODE = Array.from({ length: 40 }, (_, i) => `  const v${i} = compute(${i})`).join('\n')

function world(on: On) {
  mock.store(on)
  on('process.run', (_, e) => {
    const cmd = e.argv.join(' ')
    if (cmd.includes('HOME')) return { value: { exitCode: 0, stdout: '/h', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (e.argv.includes('rev-parse')) return { value: { exitCode: 0, stdout: '/proj\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (e.argv[0] === 'git') return { value: { exitCode: 0, stdout: 'src/a.ts\nsrc/b.ts\nREADME.md\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    // iconv: the converted copy is served below as UTF-8
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.stat', (_, e) => ({ value: { kind: 'file', size: SIZE[e.path] ?? 1118, mtimeMs: 0, isLink: false } }))
  on('fs.read', (_, e) => {
    if (e.path.endsWith('.ts')) return { value: CODE }
    if (e.path === '/h/g.txt') return { value: { base64: GBK } }
    return { value: { base64: UTF8 } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'claudo' } }))
  on('tool.call', () => ({ result: {} }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  // the engine's own row, beneath the mod
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>ROW</Text>
  })
}

type Submit = (input: unknown) => Promise<{ drop?: string; text?: string }>
const origin = { kind: 'composer' }
const slash = (args: string) => ({ text: `/claudo ${args}`.trim(), command: { name: 'claudo', args }, wait: false, origin })

async function start($: Parameters<TestBody>[0], file = '~/u.txt') {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const submit = $.prompt.submit as unknown as Submit
  const opened = await submit(slash(file))
  const call = $.tool.call as unknown as (input: unknown) => Promise<unknown>
  const row = async (id: string, tool = 'Bash') => {
    await call({ tool, command: 'date', tool_use_id: id })
    return $.ui.mount({
      plugin: 'claudo', component: 'ToolUse', requestId: id, surface: 'desktop',
      props: { tool_use_id: id, tool, input: {}, output: 'x', isRunning: false, isErrored: false, isInterrupted: false },
    } as never)
  }
  return { submit, opened, row }
}

const text = async (ui: { drawn: () => Promise<unknown> }) => JSON.stringify(await ui.drawn())


for (const [name, file] of [['utf-8', '~/u.txt'], ['gb18030', '~/g.txt']] as const) {
  test(`/claudo <file> reads a ${name} file; a row opens it on a click and turns pages`, async ($, on) => {
    world(on)
    const { opened, row } = await start($, file)
    expect(opened.drop).toBe('Ready.')

    const ui = await row('toolu_1')
    const closed = await text(ui)
    expect(closed).toContain('ROW')
    expect(closed).toContain('matches in')
    expect(closed).not.toContain('第一章 开端')

    await ui.press({ key: 'open-toolu_1' })
    expect(await text(ui)).toContain('第一章 开端')

    await ui.press({ key: 'more-toolu_1' })
    const next = await text(ui)
    expect(next).not.toContain('第一章 开端')
    expect(next).toContain('第10句')

    await ui.press({ key: 'back-toolu_1' })
    expect(await text(ui)).toContain('第一章 开端')

    await ui.press({ key: 'open-toolu_1' })
    expect(await text(ui)).not.toContain('第一章 开端')
    await ui.unmount()
  })
}

test('only Bash and Read rows get a line; one block is open at a time, at the one reading position', async ($, on) => {
  world(on)
  const { row } = await start($)
  const a = await row('toolu_a')
  await a.press({ key: 'open-toolu_a' })
  await a.press({ key: 'more-toolu_a' })
  await a.press({ key: 'more-toolu_a' })
  expect(await text(a)).toContain('第20句')
  const grep = await row('toolu_g', 'Grep')
  expect(await text(grep)).not.toContain('matches in')

  // opening another row closes the first, and shows the same page
  const b = await row('toolu_b', 'Read')
  await b.press({ key: 'open-toolu_b' })
  expect(await text(b)).toContain('第20句')
  expect(await text(a)).not.toContain('第20句')
  await b.press({ key: 'back-toolu_b' })
  expect(await text(b)).toContain('第10句')
  expect(await text(b)).not.toContain('第20句')
  for (const ui of [a, grep, b]) await ui.unmount()
})

test('"x" toggles boss mode and /claudo off and on stop and start; other prompts pass', async ($, on) => {
  world(on)
  const { submit, row } = await start($)
  const ui = await row('toolu_1')
  await ui.press({ key: 'open-toolu_1' })
  expect(await text(ui)).toContain('第一章')

  expect((await submit({ text: 'x', wait: false, origin })).drop).toBeTruthy()
  expect(await text(ui)).not.toContain('第一章')
  expect(await text(ui)).not.toContain('matches in')
  expect((await submit({ text: ' X ', wait: false, origin })).drop).toBeTruthy()
  expect(await text(ui)).toContain('第一章')

  expect((await submit(slash('off'))).drop).toBeTruthy()
  expect(await text(ui)).not.toContain('matches in')
  expect((await submit(slash(''))).drop).toContain('off')
  expect((await submit(slash('on'))).drop).toBeTruthy()
  expect(await text(ui)).toContain('matches in')

  const status = (await submit(slash(''))).drop ?? ''
  expect(status).toMatch(/^\d+\.\d%$/)
  expect(status).not.toContain('u.txt')
  expect((await submit({ text: 'fix the claudo bug', wait: false, origin })).text).toBe('fix the claudo bug')
  expect((await submit({ text: 'claudo off', wait: false, origin })).text).toBe('claudo off')
  expect((await submit({ text: 'x marks the spot', wait: false, origin })).text).toBe('x marks the spot')
  await ui.unmount()
})

test('outside a repository and with no source files, the code still comes from somewhere', async ($, on) => {
  mock.store(on)
  const ok = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
  on('process.run', (_, e) => {
    if (e.argv.join(' ').includes('HOME')) return ok('/h')
    if (e.argv.includes('rev-parse')) return ok('', 128)
    if (e.argv[0] === '/bin/pwd') return ok('/empty')
    return ok('')
  })
  on('fs.stat', () => ({ value: { kind: 'file', size: SIZE['/h/u.txt'] ?? 0, mtimeMs: 0, isLink: false } }))
  on('fs.read', () => ({ value: { base64: UTF8 } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'claudo' } }))
  on('tool.call', () => ({ result: {} }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>ROW</Text>
  })
  const { row } = await start($)
  const ui = await row('toolu_1')
  await ui.press({ key: 'open-toolu_1' })
  const shown = await text(ui)
  expect(shown).toContain('第一章')
  expect(shown).toContain('worker.ts')
  await ui.unmount()
})

test('a /claudo run acts on what was typed but hands the run on without it', async ($, on) => {
  world(on)
  const seen: string[] = []
  on('command.run', (_, e) => {
    seen.push(e.args)
    return { text: '' }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const run = $.command.run as unknown as (input: unknown) => Promise<{ text?: string }>
  const presentation = { isFullscreen: false, columns: 80 }
  const out = await run({ command: 'claudo', args: '~/u.txt', origin, presentation })
  expect(out.text).toBe('Ready.')
  expect(out.text).not.toContain('u.txt')
  expect(seen.every(a => a === '')).toBe(true)
  const status = await run({ command: 'claudo', args: '', origin, presentation })
  expect(status.text).toMatch(/^\d+\.\d%$/)
})

test('an opened block keeps the same number of lines from page to page', async ($, on) => {
  world(on)
  const { row } = await start($)
  const ui = await row('toolu_h')
  await ui.press({ key: 'open-toolu_h' })
  const sources = (node: unknown, acc: string[] = []): string[] => {
    if (Array.isArray(node)) node.forEach(n => sources(n, acc))
    else if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>
      if (o.type === 'Code' && typeof (o.props as { source?: unknown })?.source === 'string') acc.push((o.props as { source: string }).source)
      Object.values(o).forEach(v => sources(v, acc))
    }
    return acc
  }
  const heights: number[] = []
  for (let i = 0; i < 4; i++) {
    const src = sources(await ui.drawn())
    expect(src.length).toBeGreaterThan(0)
    heights.push(src[0]!.split('\n').length)
    await ui.press({ key: 'more-toolu_h' })
  }
  expect(new Set(heights).size).toBe(1)
  await ui.unmount()
})

test("no line of an opened block is wider than 64 columns, so none wraps", async ($, on) => {
  world(on)
  const { row } = await start($)
  const ui = await row('toolu_w')
  await ui.press({ key: 'open-toolu_w' })
  const cols = (t: string) => [...t].reduce((n, ch) => n + (/[⺀-꓏가-힣＀-｠]/.test(ch) ? 2 : 1), 0)
  for (let i = 0; i < 4; i++) {
    const drawn = JSON.stringify(await ui.drawn())
    const src = /"source":"((?:[^"\\]|\\.)*)"/.exec(drawn)?.[1] ?? ''
    const lines = (JSON.parse(`"${src}"`) as string).split('\n')
    expect(lines.length).toBeGreaterThan(1)
    for (const l of lines) expect(cols(l)).toBeLessThanOrEqual(64)
    await ui.press({ key: 'more-toolu_w' })
  }
  await ui.unmount()
})

test('the pieces of one long sentence sit on consecutive lines', async ($, on) => {
  world(on)
  const { row } = await start($)
  const ui = await row('toolu_s')
  await ui.press({ key: 'open-toolu_s' })
  for (let i = 0; i < 4; i++) {
    const drawn = JSON.stringify(await ui.drawn())
    const src = /"source":"((?:[^"\\]|\\.)*)"/.exec(drawn)?.[1] ?? ''
    const lines = (JSON.parse(`"${src}"`) as string).split('\n')
    // a note line that does not end a sentence is followed by another note line
    lines.forEach((l, k) => {
      if (/\/\/ /.test(l) && !/[。！？”…]\s*$/.test(l) && k + 1 < lines.length && /\/\/ /.test(lines[k + 1]!) === false) {
        expect(/第\d+句，/.test(l) || /开端$/.test(l)).toBe(true)
      }
    })
    await ui.press({ key: 'more-toolu_s' })
  }
  await ui.unmount()
})

// base64 of UTF-8, for a book made in the test
function b64(t: string) {
  const bytes = new TextEncoder().encode(t)
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += A[(n >> 18) & 63]! + A[(n >> 12) & 63]! + (i + 1 < bytes.length ? A[(n >> 6) & 63]! : '=') + (i + 2 < bytes.length ? A[n & 63]! : '=')
  }
  return out
}

test('long sentences: every page is the same height, ends on code, and keeps a sentence whole', async ($, on) => {
  // sentences of 57 to 90 characters: the reader cuts each at 56, and the
  // page puts the pieces back together
  const long = Array.from({ length: 40 }, (_, i) => `长句${i}开始` + '风从城门外卷进来吹得旗子猎猎作响'.repeat(3 + (i % 3)) + `长句${i}结束。`)
  const book = '第一章 开端\n\n' + long.join('') + '\n'
  const data = b64(book)
  const size = new TextEncoder().encode(book).length
  mock.store(on)
  const ok = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
  on('process.run', (_, e) => (e.argv.join(' ').includes('HOME') ? ok('/h') : e.argv.includes('rev-parse') ? ok('', 128) : e.argv[0] === '/bin/pwd' ? ok('/e') : ok('')))
  on('fs.stat', () => ({ value: { kind: 'file', size, mtimeMs: 0, isLink: false } }))
  on('fs.read', () => ({ value: { base64: data } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'claudo' } }))
  on('tool.call', () => ({ result: {} }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>ROW</Text>
  })
  const { row } = await start($, '~/long.txt')
  const ui = await row('toolu_l')
  await ui.press({ key: 'open-toolu_l' })
  const heights = new Set<number>()
  for (let i = 0; i < 8; i++) {
    const drawn = JSON.stringify(await ui.drawn())
    const src = /"source":"((?:[^"\\]|\\.)*)"/.exec(drawn)?.[1] ?? ''
    const lines = (JSON.parse(`"${src}"`) as string).split('\n')
    heights.add(lines.length)
    expect(lines[lines.length - 1]!.trim()).not.toBe('')
    expect(lines[lines.length - 1]!).not.toContain('// ')
    // a sentence's start and end sit in one run of note lines
    const notes = lines.map(l => (/\/\/ /.test(l) ? l.split('// ')[1]! : null))
    notes.forEach((n, k) => {
      const m = n && /长句(\d+)开始/.exec(n)
      if (!m) return
      let j = k
      while (j < notes.length && notes[j] !== null && !notes[j]!.includes(`长句${m[1]}结束`)) j++
      expect(j < notes.length && notes[j] !== null).toBe(true)
    })
    await ui.press({ key: 'more-toolu_l' })
  }
  expect(heights.size).toBe(1)
  await ui.unmount()
})
