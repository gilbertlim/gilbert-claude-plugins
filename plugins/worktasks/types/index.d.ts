export type Terminal = { path: string; title: string; state: string }

export type Board = { table: string; counts: Record<string, number>; at: string; terminals: Terminal[]; error?: string }

export type Worktree = {
  repo: string
  name: string
  commits: string
  dirty: string
  review: string
  terminal: string
  card?: string
  sessions: { state: string; title: string }[]
  lastCommit?: string
}

// 이 세션이 dispatch 한 작업. 상태는 저장하지 않고 그때그때 워크트리 표, 터미널, 보류 표시로 정한다.
export type SessionTask = { repo: string; name: string; path: string; isLanded: boolean; isHeld: boolean }

export type TaskState = 'working' | 'waiting' | 'held' | 'done'

// 우산 bin/orca-wait.sh 의 대기 알림 하나(done 끝 알림, stall 멈춤 알림).
export type Wait = { pid: number; mode: 'done' | 'stall'; path: string }

declare module 'claude-code' {
  interface PluginState {
    worktasks: { board: Board; tasks: SessionTask[]; waits: Wait[] }
  }
}
