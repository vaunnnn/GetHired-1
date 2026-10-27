// Pipe API NDJSON privately; output contains aggregate timings/regions only, never actors or request IDs.
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { distribution } from "./performance-release.mjs";

const metrics = [
  "api",
  "authentication",
  "pool",
  "transaction",
  "authorized",
  "db_control",
  "db_lock",
  "db_auth",
  "db_business",
];
const routes = ["/api/auth/me", "/api/companies", "/api/admin/companies"];
const number = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const label = (value) =>
  typeof value === "string" && /^[a-z0-9-]{1,40}$/i.test(value)
    ? value
    : "unknown";

export function summarizeTelemetry(entries) {
  const requests = entries.filter(
    (entry) =>
      entry?.event === "api.request.completed" &&
      entry.method === "GET" &&
      routes.includes(entry.route),
  );
  return {
    requests: requests.length,
    serviceRegions: [
      ...new Set(
        requests.map((entry) => label(entry.deployment?.serviceRegion)),
      ),
    ],
    databaseRegionLabels: [
      ...new Set(
        requests.map((entry) => label(entry.deployment?.databaseRegion)),
      ),
    ],
    routes: routes.map((route) => {
      const selected = requests.filter((entry) => entry.route === route);
      const connections = selected.filter(
        (entry) =>
          count(entry.connections?.firstSeen) &&
          count(entry.connections?.reused) &&
          count(entry.connections?.waitingMax),
      );
      return {
        route,
        requests: selected.length,
        failedRequests: selected.filter((entry) => entry.status !== 200).length,
        firstProcessRequests: selected.filter(
          (entry) => entry.deployment?.firstRequest === true,
        ).length,
        connectionObservations: connections.length,
        firstSeen: connections.reduce(
          (sum, entry) => sum + entry.connections.firstSeen,
          0,
        ),
        reused: connections.reduce(
          (sum, entry) => sum + entry.connections.reused,
          0,
        ),
        waitingMax: connections.length
          ? Math.max(
              ...connections.map((entry) => entry.connections.waitingMax),
            )
          : null,
        timings: Object.fromEntries(
          metrics.map((name) => [
            name,
            distribution(
              selected
                .map((entry) => entry.timings?.[name]?.durationMs)
                .filter(number),
            ),
          ]),
        ),
      };
    }),
    limits:
      "Region labels require operator confirmation. Pool duration includes connection acquisition; firstSeen is process-local. Aggregate auth timing is not isolated provider RTT. Lock timing is not a PostgreSQL wait trace. No pool-size or placement recommendation is inferred.",
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const output = process.argv[2];
  if (!output) {
    console.error(
      "Usage: pipe API NDJSON to node tests/performance-telemetry.mjs output.json",
    );
    process.exitCode = 2;
  } else {
    const entries = [];
    let invalidLines = 0;
    for await (const line of createInterface({ input: process.stdin })) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line));
      } catch {
        invalidLines++;
      }
    }
    const result = summarizeTelemetry(entries);
    await writeFile(
      output,
      JSON.stringify(
        { timestamp: new Date().toISOString(), invalidLines, ...result },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    console.log(`Aggregated ${result.requests} protected read logs.`);
    if (!result.requests || invalidLines) process.exitCode = 1;
  }
}
