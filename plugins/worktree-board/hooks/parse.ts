import type { Board, Terminal, Worktree } from '../types'

// status.sh --summary 출력을 표와 집계로 나눈다. 집계는 맨 뒤 `--- counts` 아래 key=value 줄이다.
export const parseStatus = (out: string, at: string): Board => {
  const [table = '', tail = ''] = out.split('\n--- counts\n')
  const counts: Record<string, number> = {}
  for (const line of tail.split('\n')) {
    const [k, v] = line.split('=')
    if (k && v !== undefined) counts[k.trim()] = Number(v) || 0
  }
  return { table: table.trimEnd(), counts, at, terminals: [] }
}

// 워크트리 하나의 진행: 에이전트가 막혔나, 아직 하나(터미널이 돌거나, 미커밋이 있거나, 커밋이 없다), 끝났나.
export const progressOf = (w: Worktree): 'blocked' | 'reviewing' | 'in progress' | 'done' => {
  if (w.sessions.some(x => x.state === 'blocked')) return 'blocked'
  // 리뷰어가 판정을 쓰는 중("N차 중"). 리뷰어 터미널이 돌아도 작업 중으로 세지 않는다.
  if (w.review.endsWith('중')) return 'reviewing'
  if (w.sessions.some(x => x.state === 'working') || w.dirty !== '0' || w.commits === '0') return 'in progress'
  return 'done'
}

// 상태줄 한 줄: 몇 개 중 몇 개가 진행 중이고 끝났나, 그 뒤에 리뷰 할 일.
export const statusLine = (b: Board): string => {
  if (b.error) return b.error
  const list = parseWorktrees(b.table).map(w => ({ ...w, sessions: sessionsOf(w, b.terminals) }))
  const count = (p: string) => list.filter(w => progressOf(w) === p).length
  const kinds = ['done', 'in progress', 'reviewing', 'blocked'].filter(p => count(p)).map(p => `${count(p)} ${p}`)
  const head = [`${list.length} ${list.length === 1 ? 'worktree' : 'worktrees'}${kinds.length ? `(${kinds.join(', ')})` : ''}`]
  const c = b.counts
  const tail: string[] = []
  // 미커밋이 있으면 쉬어도 in progress 로 세서, 에이전트가 실제로 도는지는 따로 센다.
  const states = list.flatMap(w => w.sessions.map(x => x.state))
  const agents = ['working', 'blocked', 'idle'].map(s => [s, states.filter(x => x === s).length] as const).filter(([, n]) => n)
  if (agents.length) tail.push(`agents ${agents.map(([s, n]) => `${n} ${s}`).join(', ')}`)
  // 리뷰를 안 받은 것과 판정 뒤에 커밋이 올라온 것을 합친다. 둘 다 리뷰를 돌려야 한다.
  const needReview = (c.review_none ?? 0) + (c.review_stale ?? 0)
  if (needReview) tail.push(`${needReview} need review`)
  return `${worktreeIcon(states.map(state => ({ state })))} ${[head.join(', '), ...tail].join(' | ')}`
}

// 표 한 줄: `<레포>/<이름> <커밋> <미커밋> <리뷰> <터미널>`. 리뷰는 "1차 낡음" 처럼 띄어 쓰고 뒤가 두 칸 이상 비어 있다.
const ROW = /^(\S+)\/(\S+)\s+(\S+)\s+(\S+)\s+(.+?)\s{2,}(.+)$/

// 좁은 패널에 세로로 쌓으려고 표를 워크트리 단위로 푼다. 카드(`└`)와 `=== 레포/이름` 아래 첫 커밋을 붙인다.
export const parseWorktrees = (table: string): Worktree[] => {
  const list: Worktree[] = []
  let section: Worktree | undefined
  for (const line of table.split('\n')) {
    const row = ROW.exec(line)
    if (row) {
      const [, repo = '', name = '', commits = '', dirty = '', review = '', terminal = ''] = row
      list.push({ repo, name, commits, dirty, review: review.trim(), terminal: terminal.trim(), sessions: [] })
      continue
    }
    const card = line.match(/^\s+└\s*(.+)$/)
    if (card && list.length > 0) {
      list[list.length - 1]!.card = card[1]
      continue
    }
    const head = line.match(/^=== (\S+)\/(\S+)$/)
    if (head) {
      section = list.find(w => w.repo === head[1] && w.name === head[2])
      continue
    }
    const commit = line.match(/^[0-9a-f]{7,} (.+)$/)
    if (commit && section && !section.lastCommit) section.lastCommit = commit[1]
  }
  return list
}


const ORDINAL = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? `${n}st` : n % 10 === 2 && n % 100 !== 12 ? `${n}nd` : n % 10 === 3 && n % 100 !== 13 ? `${n}rd` : `${n}th`)

// status.sh 리뷰 칸: "안 함", "N차", "N차 낡음", "N차 중".
export const reviewLabel = (review: string): string => {
  if (review === '안 함') return 'not reviewed'
  const m = review.match(/^(\d+)차(?: (낡음|중))?$/)
  if (!m) return review
  const n = Number(m[1])
  if (m[2] === '중') return `${ORDINAL(n)} reviewing`
  return `${ORDINAL(n)} reviewed${m[2] === '낡음' ? ', stale' : ''}`
}

// 화면 끝 상태 줄로 터미널 상태를 정한다. 입력창 바로 위 줄이 돌 때는 `✻ Osmosing… (4m 53s`, 쉴 때는 `✻ Worked for 58s · done`.
// status.sh 는 화면에 `tok/s` 가 보이면 돎으로 보는데 하단 HUD 가 쉴 때도 `out: 68.8 tok/s` 를 띄워 쉬는 터미널을 돎으로 센다.
export const screenState = (lines: string[]): string => {
  const body = lines.join('\n')
  if (/Do you (want|trust)|one you trust|❯\s*1\.|\(y\/n\)|Press Enter to continue/i.test(body)) return 'blocked'
  if (/esc to interrupt/.test(body) || lines.some(l => /^\S\s.*…\s*\(\d/.test(l))) return 'working'
  return 'idle'
}

// 패널 왼쪽에 붙여 훑어보게 한다. 워크트리는 막힘 > 돎 > 쉼 > 터미널 없음 순으로 하나를 고른다.
// 뒤의 ️ 가 있어야 네모 버튼 모양, 두 칸 폭으로 그려진다.
const ICON: Record<string, string> = { blocked: '⏸️', working: '▶️', idle: '⏺️' }
export const stateIcon = (state: string): string => ICON[state] ?? '⏹️'
export const worktreeIcon = (sessions: { state: string }[]): string =>
  stateIcon(['blocked', 'working', 'idle'].find(s => sessions.some(x => x.state === s)) ?? '')

// 워크트리의 터미널마다 상태와 탭 제목.
export const sessionsOf = (w: Worktree, terminals: Terminal[]): { state: string; title: string }[] =>
  terminals
    .filter(t => t.path.endsWith(`/${w.repo}/${w.name}`))
    .map(t => ({ state: t.state, title: t.title.replace(/^[^\p{L}\p{N}[(]+/u, '').trim() }))

// orca terminal list --json 에서 핸들, 워크트리 경로, 탭 제목을 꺼낸다. 상태는 화면을 읽어 따로 채운다.
export const parseTerminals = (json: string): (Terminal & { handle: string })[] => {
  try {
    const list = (JSON.parse(json)?.result?.terminals ?? []) as { handle?: string; worktreePath?: string; title?: string; orphaned?: boolean }[]
    return list
      .filter(t => !t.orphaned && t.worktreePath?.includes('/orca/workspaces/') && t.handle)
      .map(t => ({ handle: t.handle!, path: t.worktreePath!, title: t.title ?? '', state: 'idle' }))
  } catch {
    return []
  }
}
