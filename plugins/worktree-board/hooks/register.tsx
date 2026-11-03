import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Board } from '../types'
import { parseStatus, parseTerminals, parseWorktrees, reviewLabel, screenState, sessionsOf, stateIcon, statusLine, worktreeIcon } from './parse'

const PANE = 'worktree-board'
const TITLE = 'Orca 워크트리'
const EVERY_MS = 30_000
// 옆에 붙을 때 이만큼만 잡는다. 줄이 길면 감아서 세로로 늘린다.
const COLUMNS = 44
// 플러그인 판이 올라가도 따라가게 캐시에서 가장 높은 판의 status.sh 를 고른다.
const STATUS = 'S=$(ls -d ~/.claude/plugins/cache/orca-worktree-flow/orca/*/bin/status.sh 2>/dev/null | sort -V | tail -1); [ -n "$S" ] || { echo "status.sh 없음" >&2; exit 2; }; "$S" --summary'

const board = atom({ plugin: 'worktree-board', key: 'board' } as const, { table: '', counts: {}, at: '', terminals: [] } as Board)

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
  await update($, board, () => next)
  $.ui.status(statusLine(next))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'worktree-board', description: 'Orca 워크트리와 에이전트 진행 상황 패널을 연다(새로고침)' })
    void refresh($)
    $.clock.every(EVERY_MS, () => void refresh($))
    return next(e)
  })

  on('command.run', { command: 'worktree-board' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: TITLE, columns: COLUMNS })
    return { text: 'Orca 워크트리 패널을 열었다.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const b = await read($, board)
    const list = parseWorktrees(b.table)
    return (
      <Box flexDirection="column">
        <Text dimColor>{b.at ? `Worktree Status (${b.at}) (r${EVERY_MS / 1000}s)` : 'Worktree Status (loading)'}</Text>
        {b.error && <Text color="red" wrap="wrap">{b.error}</Text>}
        {!b.error && b.at && list.length === 0 && <Text dimColor>워크트리 없음</Text>}
        {list.map(w => {
          const sessions = sessionsOf(w, b.terminals)
          const states = sessions.map(x => x.state).join(', ')
          return (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>{worktreeIcon(sessions)} {w.repo}</Text>
              <Text color="cyan" wrap="wrap">({w.name})</Text>
              <Text>commits {w.commits}{w.dirty !== '0' ? `, dirty ${w.dirty}` : ''}</Text>
              <Text color={w.review.includes('낡음') ? 'yellow' : undefined}>{reviewLabel(w.review)}</Text>
              <Text>terminals {sessions.length}{states ? ` (${states})` : ''}</Text>
              {sessions.map(x => (
                <Text color={x.state === 'blocked' ? 'red' : x.state === 'working' ? 'green' : undefined} wrap="wrap">ㄴ {stateIcon(x.state)} [{x.state}] {x.title}</Text>
              ))}
            </Box>
          )
        })}
      </Box>
    )
  })
}
