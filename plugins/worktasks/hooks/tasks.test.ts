import { expect, test } from 'claude-code/testing'

import type { SessionTask, Terminal, Worktree } from '../types'
import { applyAction, groupTasks, parseDispatch, parseLand, parseWaits, sameWorktree, sessionDetail, stateOf } from './tasks'

const W = (name: string, review = '1차', commits = '2'): Worktree => ({ repo: 'shop-api', name, commits, dirty: '0', review, terminal: '', sessions: [] })
const T = (name: string, more: Partial<SessionTask> = {}): SessionTask => ({ repo: 'shop-api', name, path: `/h/orca/workspaces/shop-api/${name}`, isLanded: false, isHeld: false, ...more })

test('dispatch 출력에서 레포, 이름, 경로를 꺼내고 --repos 는 건너뛴다', () => {
  const out = '에이전트를 띄운다\n\n경로   /h/orca/workspaces/shop-api/add-cart\n브랜치 add-cart\n'
  expect(parseDispatch('/x/orca/1.2.9/bin/dispatch.sh shop-api add-cart /tmp/p.md 2>&1 | tail', out)).toEqual([{ repo: 'shop-api', name: 'add-cart', path: '/h/orca/workspaces/shop-api/add-cart' }])
  expect(parseDispatch('/x/bin/dispatch.sh --repos', 'agent\t/p')).toEqual([])
})

test('우산 안 dispatch 는 접두가 붙고, 경로 줄이 잘려도, 한 명령에 둘이어도 잡는다', () => {
  const out = '경로   /h/orca/workspaces/shop-web/umb.feat.login\n'
  const cmd = 'cd /u && /x/bin/dispatch.sh shop-api add-cart /tmp/a.md | tail -3 && /x/bin/dispatch.sh shop-web login /tmp/b.md'
  expect(parseDispatch(cmd, out, '/h')).toEqual([
    { repo: 'shop-api', name: 'add-cart', path: '/h/orca/workspaces/shop-api/add-cart' },
    { repo: 'shop-web', name: 'login', path: '/h/orca/workspaces/shop-web/umb.feat.login' },
  ])
})

test('접두가 붙은 워크트리도 같은 작업으로 본다', () => {
  expect(sameWorktree({ repo: 'shop-api', name: 'add-cart' }, 'shop-api', 'umb.feat.add-cart')).toBe(true)
  expect(sameWorktree({ repo: 'shop-api', name: 'add-cart' }, 'shop-api', 'umb.feat.add-cart2')).toBe(false)
  expect(sameWorktree({ repo: 'shop-api', name: 'add-cart' }, 'shop-web', 'add-cart')).toBe(false)
  expect(stateOf(T('add-cart'), [W('umb.feat.add-cart')], [])).toBe('waiting')
  const g = groupTasks([T('add-cart')], [W('umb.feat.add-cart')], [], [{ pid: 7, mode: 'stall', path: '/h/orca/workspaces/shop-api/umb.feat.add-cart' }])
  expect(g[0]!.rows[0]!.waits.length).toBe(1)
})

test('land 는 워크트리를 지웠을 때만 완료로 잡는다', () => {
  expect(parseLand('/x/bin/land.sh shop-api add-cart', '워크트리를 지웠다: /h/...')).toEqual([{ repo: 'shop-api', name: 'add-cart' }])
  expect(parseLand('/x/bin/land.sh shop-api add-cart', 'push 실패')).toEqual([])
})

test('ps 에서 대기 알림을 꺼낸다', () => {
  const ps = ' 101 bash /u/bin/orca-wait.sh done /h/orca/workspaces/shop-api/a\n 102 bash /u/bin/orca-wait.sh stall /h/orca/workspaces/shop-api/a\n 103 sleep 20\n'
  expect(parseWaits(ps)).toEqual([
    { pid: 101, mode: 'done', path: '/h/orca/workspaces/shop-api/a' },
    { pid: 102, mode: 'stall', path: '/h/orca/workspaces/shop-api/a' },
  ])
})

test('상태: land 는 완료, 보류 표시는 보류, 돌면 작업중, 나머지는 대기', () => {
  const working: Terminal[] = [{ path: '/h/orca/workspaces/shop-api/b', title: 'b', state: 'working' }]
  const list = [W('a'), W('b'), W('c', '1차 중')]
  expect(stateOf(T('a', { isLanded: true }), list, [])).toBe('done')
  expect(stateOf(T('a', { isHeld: true }), list, [])).toBe('held')
  expect(stateOf(T('b'), list, working)).toBe('working')
  expect(stateOf(T('c'), list, [])).toBe('working')
  expect(stateOf(T('a'), list, [])).toBe('waiting')
  expect(stateOf(T('gone'), list, [])).toBe('done')
})

test('summary and detail', () => {
  const tasks = [T('a'), T('d', { isLanded: true })]
  const waits = [{ pid: 1, mode: 'done' as const, path: '/h/orca/workspaces/shop-api/a' }]
  const groups = groupTasks(tasks, [W('a')], [], waits)
  expect(groups.map(g => [g.state, g.rows.length])).toEqual([['waiting', 1], ['done', 1]])
  const d = sessionDetail(groups)
  expect(d.includes('## waiting (1)')).toBe(true)
  expect(d.includes('alarms done (pid 1)')).toBe(true)
  expect(d.includes('worktree removed (landed)')).toBe(true)
  expect(d.includes('1st reviewed')).toBe(true)
})

test('고치기', () => {
  const added = applyAction([], 'add', 'shop-api', 'x', '/h')
  expect(Array.isArray(added) && added[0]!.path).toBe('/h/orca/workspaces/shop-api/x')
  const held = applyAction(added as SessionTask[], 'hold', '', 'x', '/h') as SessionTask[]
  expect(held[0]!.isHeld).toBe(true)
  expect(applyAction([], 'hold', '', 'x', '/h')).toBe('No task named x.')
  expect(typeof applyAction([], 'zap', '', 'x', '/h')).toBe('string')
})
