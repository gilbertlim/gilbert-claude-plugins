import type { SessionTask, TaskState, Terminal, Wait, Worktree } from '../types'
import { reviewLabel, sessionsOf } from './parse'

// The worktrees this session dispatched are its tasks. Landed is done, a hold mark is held,
// a running agent or reviewer is working, and the rest (finished, waiting on review, a decision or land) is waiting.

// Inside an umbrella worktree dispatch prefixes the real name with `<umbrella repo>.<umbrella name>.`,
// so a task named `add-cart` is the worktree `add-cart` or `<owner>.add-cart`.
export const sameWorktree = (t: { repo: string; name: string }, repo: string, name: string) =>
  t.repo === repo && (name === t.name || name.endsWith(`.${t.name}`))

const repoName = (path: string) => path.match(/\/([^/]+)\/([^/]+)\/?$/)?.slice(1) ?? []
const atPath = (t: { repo: string; name: string }, path: string) => {
  const [repo = '', name = ''] = repoName(path)
  return sameWorktree(t, repo, name)
}

// Every `dispatch.sh <repo> <name> <prompt>` in the command, paired in order with its `경로   <path>` line.
// The line can be cut (`| tail -3`), so a missing one falls back to the bare name; matching uses sameWorktree anyway.
// `--repos` only lists repos.
export const parseDispatch = (command: string, stdout: string, home = ''): Omit<SessionTask, 'isLanded' | 'isHeld'>[] => {
  const paths = [...stdout.matchAll(/^경로\s+(\S+)/gm)].map(m => m[1]!)
  return [...command.matchAll(/dispatch\.sh\s+(?!--)(\S+)\s+(\S+)\s+\S/g)].map(m => {
    const repo = m[1]!, name = m[2]!
    const path = paths.find(p => atPath({ repo, name }, p)) ?? `${home}/orca/workspaces/${repo}/${name}`
    return { repo, name, path }
  })
}

// `land.sh <repo> <name>` counts once it removed the worktree; with KEEP=1 the push line is enough.
// Several lands can share one command (a loop), so every call counts once the output shows a push or removal.
export const parseLand = (command: string, stdout: string): { repo: string; name: string }[] => {
  if (!/워크트리를 지웠다|->\s+main/.test(stdout)) return []
  return [...command.matchAll(/land\.sh\s+(\S+)\s+(\S+)/g)].map(m => ({ repo: m[1]!, name: m[2]! }))
}

// Wait alarms: running `orca-wait.sh done|stall <worktree>` watchers, from `ps -Ao pid=,command=`.
export const parseWaits = (ps: string): Wait[] =>
  ps.split('\n').flatMap(line => {
    const m = line.match(/^\s*(\d+)\s+.*orca-wait\.sh\s+(done|stall)\s+(\S+)/)
    return m ? [{ pid: Number(m[1]), mode: m[2] as Wait['mode'], path: m[3]! }] : []
  })

export const stateOf = (t: SessionTask, list: Worktree[], terminals: Terminal[]): TaskState => {
  if (t.isLanded) return 'done'
  if (t.isHeld) return 'held'
  const w = list.find(x => sameWorktree(t, x.repo, x.name))
  if (!w) return 'done'
  if (w.review.endsWith('중') || sessionsOf(w, terminals).some(x => x.state === 'working')) return 'working'
  return 'waiting'
}

export const LABEL: Record<TaskState, string> = { working: 'working', waiting: 'waiting', held: 'held', done: 'done' }
export const ORDER: TaskState[] = ['working', 'waiting', 'held', 'done']

export type TaskRow = {
  task: SessionTask
  worktree?: Worktree
  sessions: { state: string; title: string }[]
  waits: Wait[]
}
export type TaskGroup = { state: TaskState; rows: TaskRow[] }

// One model for the band and /worktasks: tasks grouped by state, in ORDER.
export const groupTasks = (tasks: SessionTask[], list: Worktree[], terminals: Terminal[], waits: Wait[]): TaskGroup[] =>
  ORDER.map(state => ({
    state,
    rows: tasks
      .filter(t => stateOf(t, list, terminals) === state)
      .map(task => {
        const worktree = list.find(x => sameWorktree(task, x.repo, x.name))
        return { task, worktree, sessions: worktree ? sessionsOf(worktree, terminals) : [], waits: waits.filter(x => atPath(task, x.path)) }
      }),
  })).filter(g => g.rows.length > 0)

export const alarmCount = (groups: TaskGroup[]) => groups.reduce((n, g) => n + g.rows.reduce((m, r) => m + r.waits.length, 0), 0)

// One task's detail lines, shared by the band and /worktasks.
export const rowLines = (r: TaskRow): string[] => {
  const out = [`worktree ${r.worktree ? `${r.worktree.repo}/${r.worktree.name}` : r.task.isLanded ? 'removed (landed)' : 'missing'}`]
  if (r.worktree) {
    const w = r.worktree
    out.push(`${w.commits} commits${w.dirty !== '0' ? `, ${w.dirty} uncommitted` : ''}, ${reviewLabel(w.review)}${w.lastCommit ? `, last: ${w.lastCommit}` : ''}`)
    out.push(`terminals ${r.sessions.length ? r.sessions.map(x => `${x.state} ${x.title}`).join(', ') : 'none'}`)
  }
  out.push(`alarms ${r.waits.length ? r.waits.map(x => `${x.mode} (pid ${x.pid})`).join(', ') : 'none'}`)
  return out
}

export const HELP = 'Edit with /worktasks hold|unhold|done|drop <name> or /worktasks add <repo> <name>'

// /worktasks text: grouped by state, each task with its worktree, commits and review, terminals and alarms.
export const sessionDetail = (groups: TaskGroup[]): string => {
  if (groups.length === 0) return 'No tasks dispatched in this session yet.'
  const out: string[] = []
  for (const g of groups) {
    out.push(`## ${LABEL[g.state]} (${g.rows.length})`)
    for (const r of g.rows) {
      out.push(`- ${r.task.repo}/${r.task.name}`)
      out.push(...rowLines(r).map(x => `  ${x}`))
    }
    out.push('')
  }
  out.push(HELP)
  return out.join('\n')
}

// The change /worktasks and the model's tool share. `name` is the worktree name (`add-cart`).
export const applyAction = (tasks: SessionTask[], action: string, repo: string, name: string, home: string): SessionTask[] | string => {
  const has = tasks.some(t => t.name === name)
  switch (action) {
    case 'add':
      if (!repo || !name) return 'add needs both a repo and a name.'
      if (has) return tasks
      return [...tasks, { repo, name, path: `${home}/orca/workspaces/${repo}/${name}`, isLanded: false, isHeld: false }]
    case 'hold':
    case 'unhold':
    case 'done':
    case 'drop':
      if (!has) return `No task named ${name}.`
      if (action === 'drop') return tasks.filter(t => t.name !== name)
      return tasks.map(t => (t.name !== name ? t : action === 'done' ? { ...t, isLanded: true } : { ...t, isHeld: action === 'hold' }))
    default:
      return `Unknown action ${action}. Use add, hold, unhold, done or drop.`
  }
}
