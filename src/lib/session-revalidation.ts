import type { CurrentUser } from "@gethired/contracts";
import { isSessionError } from "./api-client";

export const SESSION_FRESHNESS_MS = 15_000;

export function createSessionRevalidation(options: {
  initial: CurrentUser;
  read: () => Promise<CurrentUser>;
  onCurrent: (current: CurrentUser) => void;
  onDenied: () => void;
  onAccountChange: (current: CurrentUser) => void;
  onUnavailable: (error: unknown) => void;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  let checkedAt = now(),
    expiresAt = Date.parse(options.initial.session.expiresAt);
  let revision = 0,
    stopped = false,
    rerun = false;
  let pending: Promise<void> | undefined;
  function invalidate() {
    revision++;
    checkedAt = -Infinity;
    if (pending) rerun = true;
  }
  function check(force = false): Promise<void> {
    if (stopped) return Promise.resolve();
    if (force) invalidate();
    if (pending) return pending;
    if (now() - checkedAt < SESSION_FRESHNESS_MS && now() < expiresAt)
      return Promise.resolve();
    pending = (async () => {
      do {
        rerun = false;
        const startedRevision = revision;
        try {
          const current = await options.read();
          if (stopped) return;
          if (startedRevision !== revision) {
            rerun = true;
            continue;
          }
          if (
            current.user.id !== options.initial.user.id ||
            current.user.role !== options.initial.user.role
          ) {
            stopped = true;
            options.onAccountChange(current);
            return;
          }
          checkedAt = now();
          expiresAt = Date.parse(current.session.expiresAt);
          options.onCurrent(current);
        } catch (error) {
          if (stopped) return;
          if (startedRevision !== revision) {
            rerun = true;
            continue;
          }
          if (isSessionError(error)) {
            stopped = true;
            options.onDenied();
          } else options.onUnavailable(error);
        }
      } while (rerun && !stopped);
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  }
  return {
    check,
    invalidate,
    stop() {
      stopped = true;
      revision++;
    },
  };
}
