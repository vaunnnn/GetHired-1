import "server-only";
import { headers } from "next/headers";
import { getProxyConfig } from "./proxy/config";
import { readSession } from "./session-reader";

export async function getPageSession() {
  return readSession(new Headers(await headers()), getProxyConfig);
}
