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

declare module 'claude-code' {
  interface PluginState {
    'worktree-board': { board: Board }
  }
}
