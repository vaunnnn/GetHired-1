import { AsyncLocalStorage } from "node:async_hooks"

// Static names only: neither SQL nor request/provider data belongs in telemetry.
export const timingNames = [
  "api",
  "authentication",
  "handler",
  "pool",
  "transaction",
  "authorized",
  "session_store",
  "db_control",
  "db_lock",
  "db_auth",
  "db_business",
] as const
export type TimingName = (typeof timingNames)[number]
export type Timings = Partial<
  Record<
    TimingName,
    {
      durationMs: number
      count: number
    }
  >
>
interface TimingContext {
  timings: Timings
  queryKind?: "db_auth" | "db_business"
  connections: { firstSeen: number; reused: number; waitingMax: number }
}
const storage = new AsyncLocalStorage<TimingContext>()
let requests = 0

export function requestTiming<T>(
  work: (context: TimingContext, firstRequest: boolean) => T,
): T {
  const context: TimingContext = {
    timings: {},
    connections: { firstSeen: 0, reused: 0, waitingMax: 0 },
  }
  return storage.run(context, () => work(context, requests++ === 0))
}

export async function time<T>(
  name: TimingName,
  work: () => T | Promise<T>,
): Promise<T> {
  const context = storage.getStore()
  if (!context) return work()
  const start = performance.now()
  try {
    return await work()
  } finally {
    const metric = (context.timings[name] ??= { durationMs: 0, count: 0 })
    metric.durationMs += performance.now() - start
    metric.count++
  }
}

export function queryScope<T>(
  queryKind: "db_auth" | "db_business",
  work: () => Promise<T>,
): Promise<T> {
  const context = storage.getStore()
  return context ? storage.run({ ...context, queryKind }, work) : work()
}

export function queryTiming<T>(
  sql: string,
  work: () => Promise<T>,
): Promise<T> {
  const context = storage.getStore()
  const kind = /^\s*(begin|commit|rollback|set)\b|\bset_config\s*\(/i.test(sql)
    ? "db_control"
    : /\block_account\s*\(|\bfor\s+(?:update|share)\b/i.test(sql)
      ? "db_lock"
      : (context?.queryKind ?? "db_auth")
  return time(kind, work)
}

const seen = new WeakSet<object>()
export function recordConnection(client: object, waiting = 0) {
  const context = storage.getStore()
  if (context) {
    context.connections[seen.has(client) ? "reused" : "firstSeen"]++
    if (Number.isSafeInteger(waiting) && waiting >= 0)
      context.connections.waitingMax = Math.max(
        context.connections.waitingMax,
        waiting,
      )
  }
  seen.add(client)
}

export function safeTimings(timings: Timings): Timings {
  const safe: Timings = {}
  for (const name of timingNames) {
    const metric = timings[name]
    if (
      metric &&
      Number.isFinite(metric.durationMs) &&
      metric.durationMs >= 0 &&
      Number.isSafeInteger(metric.count) &&
      metric.count > 0
    )
      safe[name] = {
        durationMs: Math.round(metric.durationMs * 100) / 100,
        count: metric.count,
      }
  }
  return safe
}

export function serverTiming(timings: Timings): string {
  return Object.entries(safeTimings(timings))
    .map(([name, metric]) => `${name};dur=${metric.durationMs}`)
    .join(", ")
}

export function deploymentTiming(env: NodeJS.ProcessEnv = process.env) {
  const label = (value: string | undefined) =>
    value && /^[a-z0-9-]{1,40}$/i.test(value) ? value : "unknown"
  return {
    serviceRegion: label(env.API_REGION || env.VERCEL_REGION),
    databaseRegion: label(env.DATABASE_REGION),
  }
}
