import type { ApiErrorCode } from "../api/errors.js"
import { safeTimings, type Timings } from "./timing.js"

export interface RequestLog {
  requestId: string
  route: string
  method: string
  status: number
  durationMs: number
  actorId?: string
  errorCode?: ApiErrorCode
  timings?: Timings
  deployment?: { firstRequest: boolean; serviceRegion: string; databaseRegion: string }
  connections?: { firstSeen: number; reused: number; waitingMax: number }
}

export type RequestLogger = (entry: RequestLog) => void | Promise<void>

export const logRequest: RequestLogger = (entry) => {
  // Explicit allowlist. Never serialize a Request, Error, URL, or arbitrary context.
  console.info(
    JSON.stringify({
      event: "api.request.completed",
      timestamp: new Date().toISOString(),
      requestId: entry.requestId,
      route: entry.route,
      method: entry.method,
      status: entry.status,
      durationMs: entry.durationMs,
      ...(entry.actorId ? { actorId: entry.actorId } : {}),
      ...(entry.errorCode ? { errorCode: entry.errorCode } : {}),
      ...(entry.timings ? { timings: safeTimings(entry.timings) } : {}),
      ...(entry.deployment ? { deployment: {
        firstRequest: entry.deployment.firstRequest,
        serviceRegion: entry.deployment.serviceRegion,
        databaseRegion: entry.deployment.databaseRegion,
      } } : {}),
      ...(entry.connections ? { connections: {
        firstSeen: entry.connections.firstSeen,
        reused: entry.connections.reused,
        waitingMax: entry.connections.waitingMax,
      } } : {}),
    }),
  )
}
