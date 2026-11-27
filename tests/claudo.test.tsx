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
  test(`/claudo <file> reads a ${name} file; a row opens it on a click and turns its own pages`, async ($, on) => {
    world(on)
    const { opened, row } = await start($, file)
    expect(opened.drop).toContain('ready')

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
    expect(next).toMatch(/第[23]句/)

    await ui.press({ key: 'back-toolu_1' })
    expect(await text(ui)).toContain('第一章 开端')

    await ui.press({ key: 'open-toolu_1' })
    expect(await text(ui)).not.toContain('第一章 开端')
    await ui.unmount()
  })
}

test('only Bash and Read rows read; a new row goes on where reading left off', async ($, on) => {
  world(on)
  const { row } = await start($)
  const a = await row('toolu_a')
  await a.press({ key: 'open-toolu_a' })
  for (let i = 0; i < 3; i++) await a.press({ key: 'more-toolu_a' })
  const grep = await row('toolu_g', 'Grep')
  expect(await text(grep)).not.toContain('matches in')
  const b = await row('toolu_b', 'Read')
  await b.press({ key: 'open-toolu_b' })
  const shown = await text(b)
  expect(shown).toContain('lines')
  expect(shown).not.toMatch(/第[1-9]句，/)
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

  expect((await submit(slash(''))).drop).toContain('u.txt')
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
