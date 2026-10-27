import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const validMs = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
export function distribution(values) {
  const sorted = values.filter(validMs).sort((a, b) => a - b);
  return {
    n: sorted.length,
    medianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    p95Ms: sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null,
  };
}

function observations(reports, role, kind) {
  return reports.flatMap((report) =>
    kind === "recovery"
      ? (report.runs ?? [])
          .filter(
            (run) =>
              run.role === role && /^missing access recovery /.test(run.label),
          )
          .map((run) => ({
            ms: run.usableMs,
            ok: run.success !== false && validMs(run.usableMs),
            documents: run.documentCount,
          }))
      : (report.checks ?? [])
          .filter(
            (check) =>
              check.role === role &&
              check.label === "sequential reads" &&
              (kind === "session"
                ? check.path === "/api/auth/me"
                : /^\/api\/(admin\/)?companies\?/.test(check.path)),
          )
          .flatMap((check) =>
            (check.samples ?? []).map((sample) => ({
              ms: sample.durationMs,
              ok: sample.status === 200 && validMs(sample.durationMs),
            })),
          ),
  );
}

function summarize(samples) {
  const successful = samples.filter((sample) => sample.ok);
  return {
    attempts: samples.length,
    successes: successful.length,
    failures: samples.length - successful.length,
    successRate: samples.length ? successful.length / samples.length : null,
    ...distribution(successful.map((sample) => sample.ms)),
  };
}

// Recompute from individual samples; summary-only, missing and failed observations cannot pass.
export function comparePerformance(baseline, previews) {
  const gates = [
    {
      scenario: "complete preview audits",
      status:
        previews.length && previews.every((report) => !report.failure)
          ? "pass"
          : "missing_evidence",
    },
  ];
  for (const role of ["admin", "student"]) {
    for (const kind of ["session", "companies", "recovery"]) {
      const before = summarize(observations(baseline, role, kind));
      const samples = observations(previews, role, kind);
      const after = summarize(samples);
      const enough = before.n >= 30 && after.n >= 30;
      const reduction =
        before.medianMs > 0 && after.medianMs !== null
          ? 1 - after.medianMs / before.medianMs
          : null;
      const noReload =
        kind !== "recovery"
          ? true
          : samples.length
            ? samples.every((sample) => sample.documents === 1)
            : null;
      gates.push({
        role,
        scenario: kind,
        before,
        after,
        medianReduction: reduction,
        status: !enough
          ? "insufficient_samples"
          : reduction >= 0.5 &&
              after.successRate >= before.successRate &&
              noReload
            ? "pass"
            : "fail",
        ...(kind === "recovery" ? { singleDocumentRecovery: noReload } : {}),
      });
    }
    const focus = previews.flatMap((report) =>
      (report.checks ?? []).filter(
        (check) => check.role === role && check.label === "focus revalidation",
      ),
    );
    gates.push({
      role,
      scenario: "routine overlays",
      samples: focus.length,
      status:
        !focus.length ||
        focus.some((check) => !validMs(check.checkingVisibleMs))
          ? "missing_evidence"
          : focus.every(
                (check) =>
                  check.checkingVisibleMs === 0 &&
                  check.blocked === false &&
                  check.success === true,
              )
            ? "pass"
            : "fail",
    });
  }
  const independentReads = previews.flatMap((report) =>
    (report.checks ?? [])
      .filter((check) => check.label === "4 concurrent session reads")
      .map((check) => ({
        role: check.role,
        batchMs: check.durationMs,
        ...summarize(
          (check.samples ?? []).map((sample) => ({
            ms: sample.durationMs,
            ok: sample.status === 200 && validMs(sample.durationMs),
          })),
        ),
      })),
  );
  return {
    performanceGatesMet: gates.every((gate) => gate.status === "pass"),
    gates,
    independentReads,
    releaseRequirements: [
      "Confirm deployment commits, API/database/provider placement and connection/pool telemetry.",
      "Review read overlap using request/SQL traces; batch duration alone does not prove lock concurrency.",
      "Run the independent-user staging cohort after the sequential two-role comparison.",
      "Review migration compatibility and separate backend and frontend promotion/rollback.",
    ],
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [baselinePath, previewPath, outputPath] = process.argv.slice(2);
  if (!baselinePath || !previewPath || !outputPath) {
    console.error(
      "Usage: node tests/performance-release.mjs baseline.json preview.json output.json (each input: report or array of reports)",
    );
    process.exitCode = 2;
  } else {
    const load = async (path) => {
      const data = JSON.parse(await readFile(path, "utf8"));
      return Array.isArray(data) ? data : [data];
    };
    const result = comparePerformance(
      await load(baselinePath),
      await load(previewPath),
    );
    await writeFile(
      outputPath,
      JSON.stringify(
        { timestamp: new Date().toISOString(), ...result },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    console.log(
      `Performance gates: ${result.performanceGatesMet ? "passed" : "not satisfied"}. Report: ${outputPath}`,
    );
    if (!result.performanceGatesMet) process.exitCode = 1;
  }
}
