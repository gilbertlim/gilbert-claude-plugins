import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Board, SessionTask, Wait } from '../types'
import { alarmCount, applyAction, groupTasks, HELP, LABEL, parseDispatch, parseLand, parseWaits, rowLines, sessionDetail } from './tasks'
import { parseStatus, parseTerminals, parseWorktrees, screenState } from './parse'

const EVERY_MS = 30_000
// 플러그인 판이 올라가도 따라가게 캐시에서 가장 높은 판의 status.sh 를 고른다.
const STATUS = 'S=$(ls -d ~/.claude/plugins/cache/orca-worktree-flow/orca/*/bin/status.sh 2>/dev/null | sort -V | tail -1); [ -n "$S" ] || { echo "status.sh not found" >&2; exit 2; }; "$S" --summary'

const board = atom({ plugin: 'worktasks', key: 'board' } as const, { table: '', counts: {}, at: '', terminals: [] } as Board)
// 이 세션의 작업과 지금 걸린 대기 알림. 작업은 세션 상태라 다른 세션 것은 안 섞인다.
const tasks = atom({ plugin: 'worktasks', key: 'tasks' } as const, [] as SessionTask[])
const waits = atom({ plugin: 'worktasks', key: 'waits' } as const, [] as Wait[])
const TOOL = 'track'

let home = ''
const homeOf = async ($: EngineInterface) => {
  if (!home) home = (await $.process.run(['sh', '-c', 'printf %s "$HOME"'])).stdout
  return home
}

const groupsOf = async ($: EngineInterface, b?: Board) => {
  const x = b ?? (await read($, board))
  return groupTasks(await read($, tasks), parseWorktrees(x.table), x.terminals, await read($, waits))
}

const detail = async ($: EngineInterface) => sessionDetail(await groupsOf($))

// The band above the prompt opens compact; Details expands it, like ponytail's band. Kept across sessions.
const DETAILS = 'tasks-details'

// /worktasks 인자와 모델 도구 입력을 같은 고치기로 넘긴다. 결과 문구를 돌려준다.
const act = async ($: EngineInterface, action: string, repo: string, name: string) => {
  const r = applyAction(await read($, tasks), action, repo, name, await homeOf($))
  if (typeof r === 'string') return r
  await update($, tasks, () => r)
  await update($, board, x => ({ ...x }))
  const done: Record<string, string> = { add: 'Added', hold: 'Held', unhold: 'Released', done: 'Marked done:', drop: 'Dropped' }
  return `${done[action] ?? action} ${name}.`
}

const pad = (n: number) => String(n).padStart(2, '0')
const now = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const refresh = async ($: EngineInterface) => {
  let next: Board
  try {
    const r = await $.process.run(['bash', '-c', STATUS], { timeoutMs: 60_000 })
    const t = await $.process.run(['orca', 'terminal', 'list', '--json'], { timeoutMs: 30_000 }).catch(() => undefined)
    const listed = t?.exitCode === 0 ? parseTerminals(t.stdout) : []
    const terminals = await Promise.all(listed.map(async x => {
      const r = await $.process.run(['orca', 'terminal', 'read', '--terminal', x.handle, '--screen', '--json'], { timeoutMs: 15_000 }).catch(() => undefined)
      let lines: string[] = []
      try { lines = (JSON.parse(r?.stdout ?? '')?.result?.terminal?.tail ?? []) as string[] } catch { /* 못 읽으면 idle */ }
      return { path: x.path, title: x.title, state: screenState(lines.slice(-25)) }
    }))
    next = r.exitCode === 0 ? { ...parseStatus(r.stdout, now()), terminals } : { table: '', counts: {}, at: now(), terminals, error: (r.stderr || `exit ${r.exitCode}`).trim() }
  } catch (err) {
    next = { table: '', counts: {}, at: now(), terminals: [], error: String(err) }
  }
  const ps = await $.process.run(['ps', '-Ao', 'pid=,command=']).catch(() => undefined)
  await update($, waits, () => (ps?.exitCode === 0 ? parseWaits(ps.stdout) : []))
  await update($, board, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'worktasks', description: "Show this session's tasks as working, waiting, held and done. Args: hold|unhold|done|drop <name>, add <repo> <name>" })
    await $.tool.register({
      name: TOOL,
      description: "Edit this session's Orca task list (the band above the prompt and /worktasks). dispatch.sh and land.sh calls are picked up on their own; use this to add a task they missed, hold one while it waits on a person's decision, unhold it, mark it done, or drop it.",
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'hold', 'unhold', 'done', 'drop'] },
          repo: { type: 'string', description: 'Orca repo name (only for add)' },
          name: { type: 'string', description: 'Worktree name without its owner prefix, e.g. add-cart' },
        },
        required: ['action', 'name'],
      },
    })
    void refresh($)
    $.clock.every(EVERY_MS, () => void refresh($))
    return next(e)
  })

  on('command.run', { command: 'worktasks' }, async ($, e) => {
    const [action, a = '', b = ''] = e.args.trim().split(/\s+/)
    if (action) {
      const said = await act($, action, action === 'add' ? a : '', action === 'add' ? b : a)
      return { text: `${said}\n\n${await detail($)}` }
    }
    await refresh($)
    return { text: await detail($) }
  })

  on('tool.call', { tool: /^mcp__worktasks__track$/ }, async ($, e) => {
    const input = e as unknown as { action?: string; repo?: string; name?: string }
    const text = await act($, input.action ?? '', input.repo ?? '', input.name ?? '')
    return { result: text, text }
  })

  // dispatch 와 land 를 이 세션 작업으로 잡는다. 실패한 호출은 출력에 경로나 지움 줄이 없어 걸리지 않는다.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (!/(dispatch|land)\.sh/.test(e.command) || ran.deny !== undefined) return ran
    const out = (ran.result as { stdout?: string } | undefined)?.stdout ?? ''
    const d = parseDispatch(e.command, out)
    const l = parseLand(e.command, out)
    if (d) await update($, tasks, list => (list.some(t => t.name === d.name) ? list : [...list, { ...d, isLanded: false, isHeld: false }]))
    if (l) await update($, tasks, list => list.map(t => (t.name === l.name && t.repo === l.repo ? { ...t, isLanded: true } : t)))
    if (d || l) void refresh($)
    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const groups = await groupsOf($)
    if (groups.length === 0) return next(e)
    // Other mods (ponytail's band) share this slot: draw ours above theirs instead of replacing it.
    const below = await next(e).catch(() => undefined)
    const isOpen = (await $.store.get(DETAILS)) === true
    const toggle = async () => {
      await $.store.set(DETAILS, !isOpen)
      await update($, tasks, x => [...x])
    }
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = e.surface === 'terminal' ? e.props.bodyColumns : undefined
    const color = (s: string) => (s === 'working' ? 'success' : s === 'waiting' ? 'warning' : s === 'held' ? 'inactive' : undefined)
    const head = (
      <Box flexDirection="row" alignItems="center" gap={2} width={width}>
        <Text bold>Tasks</Text>
        {groups.map(g => (
          <Text key={g.state} color={color(g.state)} dimColor={g.state === 'done'}>
            {g.rows.length} {LABEL[g.state]}
          </Text>
        ))}
        {alarmCount(groups) > 0 && <Text dimColor>{alarmCount(groups)} {alarmCount(groups) === 1 ? 'alarm' : 'alarms'}</Text>}
        <Box flexGrow={1} />
        <Button key="tasks-details" plain label={isOpen ? 'Compact' : 'Details'} onPress={toggle} />
      </Box>
    )
    const mine = !isOpen ? head : (
      <Box flexDirection="column" width={width}>
        {head}
        {groups.flatMap(g =>
          g.rows.map(r => (
            <Box key={`${r.task.repo}/${r.task.name}`} flexDirection="column" marginLeft={2}>
              <Text>
                <Text color={color(g.state)}>{LABEL[g.state]}</Text> {r.task.repo}/{r.task.name}
              </Text>
              {rowLines(r).map(x => (
                <Text key={x} dimColor wrap="truncate-end">
                  {'  '}{x}
                </Text>
              ))}
            </Box>
          )),
        )}
        <Text dimColor>{HELP}</Text>
      </Box>
    )
    return below ? <Box flexDirection="column">{mine}{below}</Box> : mine
  }).catch(($, e, next) => next(e))
}
