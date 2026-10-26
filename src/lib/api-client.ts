import type {
  CurrentUser,
  RefreshResult,
  LoginInput,
  ApiSuccess,
} from "@gethired/contracts";
import { isCurrentUser } from "./current-user";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

const unavailable = () =>
  new ApiClientError(
    503,
    "SERVICE_UNAVAILABLE",
    "We couldn't reach the service. Please try again.",
  );
class SessionChangedError extends ApiClientError {
  constructor() {
    super(
      401,
      "SESSION_EXPIRED",
      "Your session changed. Please sign in again.",
    );
  }
}
export const isSessionError = (error: unknown) =>
  error instanceof ApiClientError &&
  error.status === 401 &&
  ["UNAUTHENTICATED", "SESSION_EXPIRED"].includes(error.code);

type ClientOptions = {
  fetcher?: typeof fetch;
  lock?: <T>(work: () => Promise<T>) => Promise<T>;
  notify?: (source?: string) => void;
  sharedLock?: <T>(work: () => Promise<T>) => Promise<T>;
  bindingVersion?: {
    read: () => string | null;
    write: (version: string) => void;
  };
};

// Locks serialize cookie-changing requests across same-origin tabs. Nothing in
// localStorage is trusted as identity, a credential, or proof of a refresh.
async function browserLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks)
    throw new ApiClientError(
      503,
      "BROWSER_UNSUPPORTED",
      "Please use a current browser with secure session support.",
    );
  return navigator.locks.request(
    "gethired-auth",
    { signal: AbortSignal.timeout(65000) },
    work,
  );
}

async function browserSharedLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks)
    return browserLock(work);
  return navigator.locks.request(
    "gethired-auth",
    { mode: "shared", signal: AbortSignal.timeout(65000) },
    work,
  );
}

// This marker is only an invalidation hint. It contains no token, user or authority.
const browserBindingVersion = {
  read: () => window.localStorage.getItem("gethired-csrf-generation"),
  write: (version: string) =>
    window.localStorage.setItem("gethired-csrf-generation", version),
};

function notifySessionChange(source?: string) {
  if (
    typeof window !== "undefined" &&
    typeof BroadcastChannel !== "undefined"
  ) {
    const channel = new BroadcastChannel("gethired-session");
    channel.postMessage({ type: "changed", source }); // Notification only, never a principal.
    channel.close();
  }
}

export function createApiClient({
  fetcher = fetch,
  lock = browserLock,
  notify = notifySessionChange,
  sharedLock = lock === browserLock ? browserSharedLock : lock,
  bindingVersion = browserBindingVersion,
}: ClientOptions = {}) {
  let refreshing: Promise<CurrentUser> | undefined;
  let epoch = 0;
  const source =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const listeners = new Set<(reason: "changed" | "denied") => void>();
  let channel: BroadcastChannel | undefined;
  let csrfCache:
    | { token: string; version: string; epoch: number; at: number }
    | undefined;
  const newVersion = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  function bindingChanged() {
    csrfCache = undefined;
    try {
      bindingVersion.write(newVersion());
    } catch {
      /* Without storage, writes use the exclusive fresh-CSRF path. */
    }
  }
  function cachedCsrf() {
    try {
      const age = csrfCache ? Date.now() - csrfCache.at : Infinity;
      return csrfCache &&
        age >= 0 &&
        age < 60000 &&
        csrfCache.epoch === epoch &&
        csrfCache.version === bindingVersion.read()
        ? csrfCache.token
        : undefined;
    } catch {
      return undefined;
    }
  }
  function emit(reason: "changed" | "denied") {
    epoch++;
    csrfCache = undefined;
    for (const listener of listeners) listener(reason);
  }
  function invalidateSession() {
    emit("changed");
  }
  function announce() {
    invalidateSession();
    notify(source);
  }
  function subscribeSessionChanges(
    listener: (reason: "changed" | "denied") => void,
  ) {
    listeners.add(listener);
    if (
      !channel &&
      typeof window !== "undefined" &&
      typeof BroadcastChannel !== "undefined"
    ) {
      channel = new BroadcastChannel("gethired-session");
      channel.onmessage = ({ data }) => {
        if (
          data === "changed" ||
          (data?.type === "changed" && data.source !== source)
        )
          invalidateSession();
      };
    }
    return () => {
      listeners.delete(listener);
      if (!listeners.size) {
        channel?.close();
        channel = undefined;
      }
    };
  }
  function current(value: unknown): CurrentUser {
    if (!isCurrentUser(value)) throw unavailable();
    return value;
  }

  async function send<T>(
    path: string,
    method = "GET",
    body?: unknown,
    csrf?: string,
    full = false,
  ): Promise<T> {
    if (!/^\/api\/[a-zA-Z0-9/_~-]+(?:\?[^#]*)?$/.test(path))
      throw new Error("Use a same-origin API path.");
    let response: Response;
    let envelope;
    try {
      response = await fetcher(path, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(30000),
        headers: {
          Accept: "application/json",
          ...(body === undefined || body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        ...(body === undefined
          ? {}
          : { body: body instanceof FormData ? body : JSON.stringify(body) }),
      });
      envelope = await response.json();
    } catch {
      throw unavailable();
    }
    if (!response.ok) {
      if (!envelope?.error || typeof envelope.error.code !== "string")
        throw unavailable();
      throw new ApiClientError(
        response.status,
        envelope.error.code,
        envelope.error.message,
        envelope.error.fieldErrors,
        envelope.requestId,
      );
    }
    if (
      !envelope ||
      !("data" in envelope) ||
      typeof envelope.requestId !== "string"
    )
      throw unavailable();
    return (full ? envelope : envelope.data) as T;
  }

  async function csrf() {
    const result = await send<{ csrfToken: string }>("/api/auth/csrf");
    if (typeof result.csrfToken !== "string" || !result.csrfToken)
      throw unavailable();
    return result.csrfToken;
  }

  async function mutation<T>(
    path: string,
    method: string,
    body: unknown,
  ): Promise<T> {
    // Fetch against the current binding, including changes made by another tab.
    return send<T>(path, method, body, await csrf());
  }

  async function businessMutation<T>(
    path: string,
    method: string,
    body: unknown,
  ): Promise<T> {
    const notSent = Symbol("not-sent");
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!cachedCsrf()) {
        const initialized = await lock(async () => {
          if (cachedCsrf()) return { sent: false as const };
          csrfCache = undefined;
          let version: string | null;
          try {
            version = bindingVersion.read();
          } catch {
            return {
              sent: true as const,
              result: await mutation<T>(path, method, body),
            };
          }
          // Anonymous binding issuance must happen exclusively, before shared writes.
          const token = await csrf();
          try {
            if (!version) version = newVersion();
            // Also verify writability when an existing marker was inherited.
            bindingVersion.write(version);
            if (version !== bindingVersion.read())
              return { sent: false as const };
            csrfCache = { token, version, epoch, at: Date.now() };
          } catch {
            return {
              sent: true as const,
              result: await send<T>(path, method, body, token),
            };
          }
          return { sent: false as const };
        });
        if (initialized.sent) return initialized.result;
      }
      const result = await sharedLock(async () => {
        const token = cachedCsrf();
        // A cookie-changing writer may have run between initialization and this lock.
        // Loop only if no HTTP mutation has been sent. Errors/uncertain writes never replay.
        if (!token) return notSent;
        try {
          return await send<T>(path, method, body, token);
        } catch (error) {
          csrfCache = undefined;
          throw error;
        }
      });
      if (result !== notSent) return result;
    }
    throw new ApiClientError(
      409,
      "SESSION_CHANGED",
      "Your session changed. Please try again.",
    );
  }

  function refresh(): Promise<CurrentUser> {
    if (refreshing) return refreshing;
    const startedEpoch = epoch;
    const verified = (value: unknown) => {
      if (epoch !== startedEpoch) throw new SessionChangedError();
      return current(value);
    };
    return (refreshing = lock(async () => {
      // Another tab may already have refreshed while this tab waited for the lock.
      try {
        const result = await send<CurrentUser>("/api/auth/me");
        return verified(result);
      } catch (error) {
        if (!isSessionError(error)) throw error;
      }
      // A login/logout notification invalidates this recovery, even if it arrived
      // while waiting for the lock. Never rotate credentials after that change.
      if (epoch !== startedEpoch) throw new SessionChangedError();
      return verified(
        await mutation<RefreshResult>("/api/auth/refresh", "POST", {}),
      );
    })
      .catch((error) => {
        if (
          epoch === startedEpoch &&
          isSessionError(error) &&
          !(error instanceof SessionChangedError)
        )
          emit("denied");
        throw error;
      })
      .finally(() => {
        refreshing = undefined;
      }));
  }

  return {
    refresh,
    invalidateSession,
    subscribeSessionChanges,
    async list<T>(path: string): Promise<ApiSuccess<T[]>> {
      try {
        return await send<ApiSuccess<T[]>>(
          path,
          "GET",
          undefined,
          undefined,
          true,
        );
      } catch (error) {
        if (isSessionError(error)) {
          await refresh();
          return send<ApiSuccess<T[]>>(path, "GET", undefined, undefined, true);
        }
        throw error;
      }
    },
    async get<T>(path: string): Promise<T> {
      try {
        return await send<T>(path);
      } catch (error) {
        if (isSessionError(error)) {
          const recovered = await refresh();
          return path === "/api/auth/me" ? (recovered as T) : send<T>(path);
        }
        // Only reads get one transient retry. Mutations are never automatically replayed.
        if (error instanceof ApiClientError && error.status === 503)
          return send<T>(path);
        throw error;
      }
    },
    async me() {
      return current(await this.get<CurrentUser>("/api/auth/me"));
    },
    login(input: LoginInput) {
      invalidateSession();
      return lock(async () => {
        bindingChanged();
        try {
          const current = await mutation<CurrentUser>(
            "/api/auth/login",
            "POST",
            input,
          );
          await csrf(); // Login rotates the browser binding.
          return current;
        } finally {
          announce();
        }
      });
    },
    logout() {
      invalidateSession();
      return lock(async () => {
        bindingChanged();
        try {
          await mutation("/api/auth/logout", "POST", {});
        } finally {
          announce();
        }
      });
    },
    mutate<T>(
      path: string,
      method: "POST" | "PUT" | "PATCH" | "DELETE",
      body: unknown,
    ) {
      if (path.startsWith("/api/auth/")) {
        invalidateSession();
        return lock(async () => {
          bindingChanged();
          try {
            return await mutation<T>(path, method, body);
          } finally {
            announce();
          }
        });
      }
      return businessMutation<T>(path, method, body);
    },
  };
}

export const apiClient = createApiClient();
