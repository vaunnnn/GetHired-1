import type { CurrentUser } from "@gethired/contracts";
import { createApiProxy } from "./proxy/handler";
import type { ProxyConfig } from "./proxy/config";

export type SessionResult = { kind: "authenticated"; current: CurrentUser } |
  { kind: "unauthenticated" } | { kind: "unavailable" };

// GET only: server rendering cannot deliver rotated cookies to the browser.
export async function readSession(incoming: Headers, config: () => ProxyConfig | undefined,
  fetcher: typeof fetch = fetch): Promise<SessionResult> {
  try {
    const settings = config();
    const headers = new Headers();
    headers.set("cookie", incoming.get("cookie") ?? "");
    if (settings?.trustedIpHeader) {
      const ip = incoming.get(settings.trustedIpHeader);
      if (ip) headers.set(settings.trustedIpHeader, ip);
    }
    const response = await createApiProxy(() => settings, fetcher)(
      new Request("http://internal/api/auth/me", { headers }),
    );
    if (response.status === 401) return { kind: "unauthenticated" };
    if (!response.ok) return { kind: "unavailable" };
    const { data } = await response.json();
    if (!data?.user?.id || !["student", "admin"].includes(data.user.role) || !data.session?.expiresAt)
      return { kind: "unavailable" };
    return { kind: "authenticated", current: data };
  } catch { return { kind: "unavailable" }; }
}
