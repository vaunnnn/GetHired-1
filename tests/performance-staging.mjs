// Bounded independent-user browser cohort. Account secrets are stdin-only and never written.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const [target, outputDirectory] = process.argv.slice(2);
assert.ok(
  target && outputDirectory,
  "Usage: node tests/performance-staging.mjs https://STAGING-origin output-directory < accounts-json-stdin",
);
const url = new URL(target);
assert.ok(
  url.protocol === "https:" &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password,
  "Use an exact HTTPS staging origin",
);
assert.notEqual(
  url.hostname,
  "gethired-1.vercel.app",
  "Independent-user load must not target the live baseline",
);
assert.equal(
  process.env.PERF_TARGET_ENVIRONMENT,
  "staging",
  "Set PERF_TARGET_ENVIRONMENT=staging only for a verified nonproduction target",
);
let input = "";
for await (const part of process.stdin) input += part;
let accounts;
try {
  accounts = JSON.parse(input);
} catch {
  throw new Error(
    "Account stdin must contain valid JSON; input was not logged",
  );
}
input = "";
assert.ok(
  Array.isArray(accounts) && accounts.length >= 2 && accounts.length <= 4,
  "Use 2–4 independent staging accounts",
);
assert.ok(
  accounts.some((account) => account.role === "admin") &&
    accounts.some((account) => account.role === "student"),
  "Both roles required",
);
assert.ok(
  accounts.every(
    (account) =>
      ["admin", "student"].includes(account.role) &&
      typeof account.identifier === "string" &&
      account.identifier.trim() &&
      typeof account.password === "string" &&
      account.password,
  ),
  "Invalid account input",
);
assert.equal(
  new Set(accounts.map((account) => account.identifier.trim().toLowerCase()))
    .size,
  accounts.length,
  "Each worker needs a distinct account",
);
await mkdir(outputDirectory); // Refuse overwrite/reuse of a previous cohort.
const started = new Date().toISOString();
const workers = await Promise.all(
  accounts.map(async (account, index) => {
    const file = join(outputDirectory, `user-${index + 1}.json`);
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL("./performance-audit.mjs", import.meta.url))],
      {
        windowsHide: true,
        stdio: ["pipe", "ignore", "ignore"],
        env: {
          ...process.env,
          PERF_URL: url.origin,
          PERF_OUTPUT: file,
          PERF_NAV_ONLY: "false",
          PERF_SAMPLES: "30",
          PERF_NAV_SAMPLES: "30",
          PERF_RECOVERY_SAMPLES: "30",
        },
      },
    );
    const completion = new Promise((resolve) => {
      child.once("error", () =>
        resolve({ role: account.role, worker: index + 1, success: false }),
      );
      child.once("exit", (code) =>
        resolve({ role: account.role, worker: index + 1, success: code === 0 }),
      );
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify([account]));
    return completion;
  }),
);
// Preserve per-worker failures too; never allow a partial cohort to appear successful.
const reports = [];
for (let index = 0; index < workers.length; index++) {
  try {
    reports.push(
      JSON.parse(
        await readFile(join(outputDirectory, `user-${index + 1}.json`), "utf8"),
      ),
    );
  } catch {
    workers[index].success = false;
  }
}
await writeFile(
  join(outputDirectory, "reports.json"),
  JSON.stringify(reports, null, 2) + "\n",
);
await writeFile(
  join(outputDirectory, "cohort.json"),
  JSON.stringify(
    {
      started,
      finished: new Date().toISOString(),
      target: url.origin,
      independentAccounts: accounts.length,
      samplesPerScenarioPerAccount: 30,
      workers,
      success: workers.every((worker) => worker.success),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Independent staging users completed: ${workers.filter((worker) => worker.success).length}/${workers.length}`,
);
if (workers.some((worker) => !worker.success)) process.exitCode = 1;
