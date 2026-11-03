import { expect, test } from 'claude-code/testing'

import { parseStatus, parseTerminals, parseWorktrees, progressOf, reviewLabel, screenState, sessionsOf, statusLine, worktreeIcon } from './parse'

const TABLE = `워크트리                             커밋 미커밋 리뷰         터미널
--------------------------------------------------------------------------------
shop-api/add-cart 2      0       1차 낡음    2개, 쉼, 쉼
                                         └ [in-progress] 리뷰 지적 반영 커밋함
shop-web/login-fix 1      0       안 함        1개, 쉼

=== shop-api/add-cart
10c593c 장바구니 API 를 더한다
5d5f4f3 장바구니 표를 만든다`

const COUNTS = '\n\n--- counts\nworktrees=2\nreview_stale=1\nreview_none=1\nblocked=0\n'

test('status.sh 출력을 표와 집계로 나눈다', () => {
  const b = parseStatus(TABLE + COUNTS, 't')
  expect(b.table.endsWith('5d5f4f3 장바구니 표를 만든다')).toBe(true)
  expect(b.counts.worktrees).toBe(2)
  expect(b.counts.review_stale).toBe(1)
})

test('표를 워크트리 단위로 풀고 카드와 마지막 커밋을 붙인다', () => {
  const [a, b] = parseWorktrees(TABLE)
  expect(a).toEqual({ repo: 'shop-api', name: 'add-cart', commits: '2', dirty: '0', review: '1차 낡음',
    terminal: '2개, 쉼, 쉼', sessions: [], card: '[in-progress] 리뷰 지적 반영 커밋함', lastCommit: '장바구니 API 를 더한다' })
  expect(b?.review).toBe('안 함')
})

test('화면 끝 상태 줄로 돎, 쉼, 막힘을 가른다. HUD 의 tok/s 는 무시한다', () => {
  expect(screenState(['✻ Osmosing… (4m 53s · ↓ 2.2k tokens)', '────', '❯', '  out: 68.8 tok/s'])).toBe('working')
  expect(screenState(['✻ Worked for 58s · done 2:09 PM', '────', '❯', '  out: 68.8 tok/s'])).toBe('idle')
  expect(screenState(['Do you want to proceed?', '❯ 1. Yes'])).toBe('blocked')
})

test('워크트리 터미널만 골라 상태와 제목(앞 기호 뺌)을 붙인다', () => {
  const listed = parseTerminals(JSON.stringify({ result: { terminals: [
    { handle: 'h1', worktreePath: '/u/orca/workspaces/shop-api/add-cart', title: '✳ 로그인 후 작업 재개' },
    { handle: 'h2', worktreePath: '/u/repo/main', title: '✳ 메인 체크아웃' },
  ] } }))
  expect(listed.map(t => t.handle)).toEqual(['h1'])
  const [a] = parseWorktrees(TABLE)
  expect(sessionsOf(a!, [{ ...listed[0]!, state: 'working' }])).toEqual([{ state: 'working', title: '로그인 후 작업 재개' }])
})

test('진행: 돌면 in progress, 리뷰 중이면 reviewing, 커밋 있고 쉬면 done', () => {
  const [a] = parseWorktrees(TABLE)
  expect(progressOf({ ...a!, sessions: [{ state: 'working', title: '' }] })).toBe('in progress')
  expect(progressOf({ ...a!, review: '2차 중', sessions: [{ state: 'working', title: '' }] })).toBe('reviewing')
  expect(progressOf({ ...a!, sessions: [{ state: 'idle', title: '' }] })).toBe('done')
})

test('상태줄은 worktrees N(종류별 수) | need review M', () => {
  const b = { ...parseStatus(TABLE + COUNTS, ''),
    terminals: [{ path: '/u/orca/workspaces/shop-web/login-fix', title: '', state: 'working' }] }
  expect(statusLine(b)).toBe('▶\uFE0F 2 worktrees(1 done, 1 in progress) | agents 1 working | 2 need review')
  const idle = { ...b, terminals: [{ ...b.terminals[0]!, state: 'idle' }, { path: '/u/orca/workspaces/shop-api/add-cart', title: '', state: 'blocked' }] }
  expect(statusLine(idle)).toBe('⏸\uFE0F 2 worktrees(1 done, 1 blocked) | agents 1 blocked, 1 idle | 2 need review')
  expect(statusLine({ table: '', counts: {}, at: '', terminals: [], error: 'status.sh 없음' })).toBe('status.sh 없음')
})

test('워크트리 아이콘은 막힘 > 돎 > 쉼 > 터미널 없음', () => {
  expect(worktreeIcon([{ state: 'idle' }, { state: 'blocked' }, { state: 'working' }])).toBe('⏸\uFE0F')
  expect(worktreeIcon([{ state: 'idle' }, { state: 'working' }])).toBe('▶\uFE0F')
  expect(worktreeIcon([{ state: 'idle' }])).toBe('⏺\uFE0F')
  expect(worktreeIcon([])).toBe('⏹\uFE0F')
})

test('리뷰 칸을 영문 차수로 바꾼다', () => {
  expect(reviewLabel('안 함')).toBe('not reviewed')
  expect(reviewLabel('1차')).toBe('1st reviewed')
  expect(reviewLabel('2차 낡음')).toBe('2nd reviewed, stale')
  expect(reviewLabel('3차 중')).toBe('3rd reviewing')
})
