import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

// "第一章 开端" then 29 sentences, as UTF-8 and as GB18030
const UTF8 = '56ys5LiA56ugIOW8gOerrwoK44CA44CA56ysMeWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDLlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwz5Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysNOWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDXlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKw25Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysN+WPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDjlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKw55Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMTDlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwxMeWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDEy5Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMTPlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwxNOWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDE15Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMTblj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwxN+WPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDE45Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMTnlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwyMOWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDIx5Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMjLlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwyM+WPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDI05Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMjXlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwyNuWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAguesrDI35Y+l77yM6aOO5LuO5Z+O6Zeo5aSW5Y236L+b5p2l44CC56ysMjjlj6XvvIzpo47ku47ln47pl6jlpJbljbfov5vmnaXjgILnrKwyOeWPpe+8jOmjjuS7juWfjumXqOWkluWNt+i/m+adpeOAggo='
const GBK = 'tdrSu9XCIL+qtssKCqGhoaG12jG+5KOst+e007PHw8XN4r7tvfjAtKGjtdoyvuSjrLfntNOzx8PFzeK+7b34wLSho7XaM77ko6y357TTs8fDxc3ivu29+MC0oaO12jS+5KOst+e007PHw8XN4r7tvfjAtKGjtdo1vuSjrLfntNOzx8PFzeK+7b34wLSho7XaNr7ko6y357TTs8fDxc3ivu29+MC0oaO12je+5KOst+e007PHw8XN4r7tvfjAtKGjtdo4vuSjrLfntNOzx8PFzeK+7b34wLSho7XaOb7ko6y357TTs8fDxc3ivu29+MC0oaO12jEwvuSjrLfntNOzx8PFzeK+7b34wLSho7XaMTG+5KOst+e007PHw8XN4r7tvfjAtKGjtdoxMr7ko6y357TTs8fDxc3ivu29+MC0oaO12jEzvuSjrLfntNOzx8PFzeK+7b34wLSho7XaMTS+5KOst+e007PHw8XN4r7tvfjAtKGjtdoxNb7ko6y357TTs8fDxc3ivu29+MC0oaO12jE2vuSjrLfntNOzx8PFzeK+7b34wLSho7XaMTe+5KOst+e007PHw8XN4r7tvfjAtKGjtdoxOL7ko6y357TTs8fDxc3ivu29+MC0oaO12jE5vuSjrLfntNOzx8PFzeK+7b34wLSho7XaMjC+5KOst+e007PHw8XN4r7tvfjAtKGjtdoyMb7ko6y357TTs8fDxc3ivu29+MC0oaO12jIyvuSjrLfntNOzx8PFzeK+7b34wLSho7XaMjO+5KOst+e007PHw8XN4r7tvfjAtKGjtdoyNL7ko6y357TTs8fDxc3ivu29+MC0oaO12jI1vuSjrLfntNOzx8PFzeK+7b34wLSho7XaMja+5KOst+e007PHw8XN4r7tvfjAtKGjtdoyN77ko6y357TTs8fDxc3ivu29+MC0oaO12jI4vuSjrLfntNOzx8PFzeK+7b34wLSho7XaMjm+5KOst+e007PHw8XN4r7tvfjAtKGjCg=='
const SIZE: Record<string, number> = { '/h/u.txt': 1118, '/h/g.txt': 763 }

const PANE = {
  plugin: 'claudo',
  component: 'Pane',
  requestId: 'claudo',
  props: { title: 'Trace', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

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
  on('command.register', () => ({ value: { command: 'trace' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}

for (const [name, file] of [['utf-8', '~/u.txt'], ['gb18030', '~/g.txt']] as const) {
  test(`a ${name} file reads as replies and code, and pages`, async ($, on) => {
    world(on)
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    await ui.input({ key: 'file', text: file })
    // the load runs behind the submit; draw until the text shows
    let page = JSON.stringify(await ui.drawn())
    for (let i = 0; i < 20 && !page.includes('第'); i++) page = JSON.stringify(await ui.drawn())
    expect(page).toContain('第一章 开端')
    expect(page).toContain('Cogitated')
    await ui.press({ key: 'next' })
    const two = JSON.stringify(await ui.drawn())
    expect(two).not.toContain('第一章 开端')
    expect(two).toContain('第8句')
    await ui.press({ key: 'boss' })
    const boss = JSON.stringify(await ui.drawn())
    expect(boss).not.toContain('城门')
    expect(boss).toContain('passed')
    await ui.press({ key: 'boss' })
    await ui.press({ key: 'prev' })
    expect(JSON.stringify(await ui.drawn())).toContain('第一章 开端')
    await ui.unmount()
  })
}

test('a Bash or Read row gets a quiet line that opens the text on a click; the boss key hides it', async ($, on) => {
  world(on)
  on('tool.call', () => ({ result: {} }))
  // the engine's own row, beneath the mod
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>ROW</Text>
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.input({ key: 'file', text: '~/u.txt' })
  for (let i = 0; i < 20 && !JSON.stringify(await pane.drawn()).includes('第'); i++) {}

  const call = $.tool.call as unknown as (input: unknown) => Promise<unknown>
  await call({ tool: 'Bash', command: 'date', tool_use_id: 'toolu_b' })
  await call({ tool: 'Grep', pattern: 'x', tool_use_id: 'toolu_g' })

  const mount = (id: string, tool: string) =>
    $.ui.mount({
      plugin: 'claudo', component: 'ToolUse', requestId: id, surface: 'desktop',
      props: { tool_use_id: id, tool, input: {}, output: 'x', isRunning: false, isErrored: false, isInterrupted: false },
    } as never)
  const bash = await mount('toolu_b', 'Bash')
  const grep = await mount('toolu_g', 'Grep')

  // closed: the row and a summary line, no text from the file
  const closed = JSON.stringify(await bash.drawn())
  expect(closed).toContain('ROW')
  expect(closed).toContain('matches in')
  expect(closed).not.toContain('城门')
  expect(JSON.stringify(await grep.drawn())).not.toContain('matches in')

  await bash.press({ key: 'open-toolu_b' })
  expect(JSON.stringify(await bash.drawn())).toContain('城门')

  await pane.press({ key: 'boss' })
  const boss = JSON.stringify(await bash.drawn())
  expect(boss).not.toContain('城门')
  expect(boss).not.toContain('matches in')

  await pane.press({ key: 'boss' })
  await bash.press({ key: 'open-toolu_b' })
  expect(JSON.stringify(await bash.drawn())).not.toContain('城门')
  for (const ui of [bash, grep, pane]) await ui.unmount()
})

test('"x" sent from the message box toggles boss mode and is dropped; other prompts pass', async ($, on) => {
  world(on)
  on('tool.call', () => ({ result: {} }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>ROW</Text>
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.input({ key: 'file', text: '~/u.txt' })
  for (let i = 0; i < 20 && !JSON.stringify(await pane.drawn()).includes('第'); i++) {}
  const call = $.tool.call as unknown as (input: unknown) => Promise<unknown>
  await call({ tool: 'Bash', command: 'date', tool_use_id: 'toolu_b' })
  const row = await $.ui.mount({
    plugin: 'claudo', component: 'ToolUse', requestId: 'toolu_b', surface: 'desktop',
    props: { tool_use_id: 'toolu_b', tool: 'Bash', input: {}, output: 'x', isRunning: false, isErrored: false, isInterrupted: false },
  } as never)
  expect(JSON.stringify(await row.drawn())).toContain('matches in')

  const submit = $.prompt.submit as unknown as (input: unknown) => Promise<{ drop?: string; text?: string }>
  const origin = { kind: 'composer' }
  expect((await submit({ text: 'x', wait: false, origin })).drop).toBeTruthy()
  expect(JSON.stringify(await row.drawn())).not.toContain('matches in')
  expect((await submit({ text: ' X ', wait: false, origin })).drop).toBeTruthy()
  expect(JSON.stringify(await row.drawn())).toContain('matches in')
  expect((await submit({ text: 'fix the bug', wait: false, origin })).text).toBe('fix the bug')
  await row.unmount()
  await pane.unmount()
})

test('outside a repository and with no source files, the code still comes from somewhere', async ($, on) => {
  mock.store(on)
  on('process.run', (_, e) => {
    const ok = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (e.argv.join(' ').includes('HOME')) return ok('/h')
    if (e.argv.includes('rev-parse')) return ok('', 128)
    if (e.argv[0] === '/bin/pwd') return ok('/empty')
    return ok('')
  })
  on('fs.stat', () => ({ value: { kind: 'file', size: SIZE['/h/u.txt'] ?? 0, mtimeMs: 0, isLink: false } }))
  on('fs.read', () => ({ value: { base64: UTF8 } }))
  on('command.register', () => ({ value: { command: 'claudo' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.input({ key: 'file', text: '~/u.txt' })
  let page = ''
  for (let i = 0; i < 20 && !page.includes('第'); i++) page = JSON.stringify(await ui.drawn())
  expect(page).toContain('第一章 开端')
  // every page has at least one block; code ones come from the fallback
  for (let i = 0; i < 3; i++) await ui.press({ key: 'next' })
  expect(JSON.stringify(await ui.drawn())).toContain('Cogitated')
  await ui.unmount()
})

test('a click on any line of the page turns to the next page; not in boss mode', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.input({ key: 'file', text: '~/u.txt' })
  for (let i = 0; i < 20 && !JSON.stringify(await ui.drawn()).includes('第'); i++) {}
  const lineKey = async () =>
    (await ui.findAll({ type: 'Button' }))
      .map(b => (b as { key?: string }).key ?? '')
      .find(k => !['prev', 'boss', 'next', 'inline'].includes(k))
  const first = await lineKey()
  expect(first).toBeTruthy()
  await ui.press({ key: first! })
  const two = JSON.stringify(await ui.drawn())
  expect(two).not.toContain('第一章 开端')
  expect(two).toContain('第8句')

  await ui.press({ key: 'boss' })
  const bossKey = await lineKey()
  if (bossKey) await ui.press({ key: bossKey })
  await ui.press({ key: 'boss' })
  expect(JSON.stringify(await ui.drawn())).toContain('第8句')

  await ui.press({ key: 'prev' })
  expect(JSON.stringify(await ui.drawn())).toContain('第一章 开端')
  await ui.unmount()
})
