import { expect, test } from 'claude-code/testing'

import { parseStatus, parseTerminals, parseWorktrees, reviewLabel, screenState, sessionsOf } from './parse'

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

test('리뷰 칸을 영문 차수로 바꾼다', () => {
  expect(reviewLabel('안 함')).toBe('not reviewed')
  expect(reviewLabel('1차')).toBe('1st reviewed')
  expect(reviewLabel('2차 낡음')).toBe('2nd reviewed, stale')
  expect(reviewLabel('3차 중')).toBe('3rd reviewing')
})
