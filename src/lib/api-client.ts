import type { CurrentUser, LoginInput } from "@gethired/contracts";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
    readonly requestId?: string,
  ) { super(message); }
}

const unavailable = () => new ApiClientError(503, "SERVICE_UNAVAILABLE", "We couldn't reach the service. Please try again.");
export const isSessionError = (error: unknown) => error instanceof ApiClientError &&
  error.status === 401 && ["UNAUTHENTICATED", "SESSION_EXPIRED"].includes(error.code);

type ClientOptions = {
  fetcher?: typeof fetch;
  lock?: <T>(work: () => Promise<T>) => Promise<T>;
  notify?: () => void;
};

// Locks serialize cookie-changing requests across same-origin tabs. Nothing in
// localStorage is trusted as identity, a credential, or proof of a refresh.
async function browserLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks)
    throw new ApiClientError(503, "BROWSER_UNSUPPORTED", "Please use a current browser with secure session support.");
  return navigator.locks.request("gethired-auth", { signal: AbortSignal.timeout(65000) }, work);
}

function notifySessionChange() {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("gethired-session");
    channel.postMessage("changed"); // Notification only; recipients must query /auth/me.
    channel.close();
  }
}

export function createApiClient({ fetcher = fetch, lock = browserLock, notify = notifySessionChange }: ClientOptions = {}) {
  let refreshing: Promise<CurrentUser> | undefined;

  async function send<T>(path: string, method = "GET", body?: unknown, csrf?: string): Promise<T> {
    if (!/^\/api\/[a-zA-Z0-9/_~-]+(?:\?[^#]*)?$/.test(path)) throw new Error("Use a same-origin API path.");
    let response: Response;
    let envelope;
    try {
      response = await fetcher(path, {
        method, credentials: "same-origin", cache: "no-store", redirect: "error",
        signal: AbortSignal.timeout(30000),
        headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      envelope = await response.json();
    } catch { throw unavailable(); }
    if (!response.ok) {
      if (!envelope?.error || typeof envelope.error.code !== "string") throw unavailable();
      throw new ApiClientError(response.status, envelope.error.code, envelope.error.message,
        envelope.error.fieldErrors, envelope.requestId);
    }
    if (!envelope || !("data" in envelope) || typeof envelope.requestId !== "string") throw unavailable();
    return envelope.data as T;
  }

  async function csrf() {
    const result = await send<{ csrfToken: string }>("/api/auth/csrf");
    if (typeof result.csrfToken !== "string" || !result.csrfToken) throw unavailable();
    return result.csrfToken;
  }

  async function mutation<T>(path: string, method: string, body: unknown): Promise<T> {
    // Fetch against the current binding, including changes made by another tab.
    return send<T>(path, method, body, await csrf());
  }

  function refresh(): Promise<CurrentUser> {
    return refreshing ??= lock(async () => {
      // Another tab may already have refreshed while this tab waited for the lock.
      try { return await send<CurrentUser>("/api/auth/me"); }
      catch (error) { if (!isSessionError(error)) throw error; }
      await mutation("/api/auth/refresh", "POST", {});
      await csrf();
      const current = await send<CurrentUser>("/api/auth/me");
      notify();
      return current;
    }).finally(() => { refreshing = undefined; });
  }

  return {
    refresh,
    async get<T>(path: string): Promise<T> {
      try { return await send<T>(path); }
      catch (error) {
        if (isSessionError(error)) { await refresh(); return send<T>(path); }
        // Only reads get one transient retry. Mutations are never automatically replayed.
        if (error instanceof ApiClientError && error.status === 503) return send<T>(path);
        throw error;
      }
    },
    me() { return this.get<CurrentUser>("/api/auth/me"); },
    login(input: LoginInput) {
      return lock(async () => {
        const current = await mutation<CurrentUser>("/api/auth/login", "POST", input);
        notify();
        await csrf(); // Login rotates the browser binding.
        return current;
      });
    },
    logout() {
      return lock(async () => {
        await mutation("/api/auth/logout", "POST", {});
        notify();
      });
    },
    mutate<T>(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body: unknown) {
      return lock(() => mutation<T>(path, method, body));
    },
  };
}

export const apiClient = createApiClient();
