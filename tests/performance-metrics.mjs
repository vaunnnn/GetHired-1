// Runs before application scripts. Only numeric timings and fixed event names leave the page.
export const browserTimingSource = `(() => {
  if (window !== window.top) return;
  const documentId = performance.timeOrigin;
  const emit = (kind, duration = 0, at = Date.now()) => {
    try { window.__getHiredPerfRecord(JSON.stringify({ kind, at, duration, documentId })); } catch {}
  };
  emit('document');
  let checking = false;
  const inspect = () => {
    const visible = document.body?.innerText.includes('Checking your session') ?? false;
    if (visible !== checking) { checking = visible; emit(visible ? 'checking_start' : 'checking_end'); }
  };
  new MutationObserver(inspect).observe(document, { childList: true, subtree: true, characterData: true });
  addEventListener('pagehide', () => { if (checking) { checking = false; emit('checking_end'); } });
  try {
    new PerformanceObserver(list => {
      for (const task of list.getEntries()) emit('long_task', task.duration, performance.timeOrigin + task.startTime);
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
})();`

export function summarizeNavigation(events, traffic, start, shellReady) {
  const intervals = new Map()
  let checkingVisibleMs = 0
  for (const event of events) {
    if (event.kind === "checking_start")
      intervals.set(event.documentId, event.at)
    if (event.kind === "checking_end" && intervals.has(event.documentId)) {
      checkingVisibleMs += Math.max(
        0,
        Math.min(shellReady, event.at) -
          Math.max(start, intervals.get(event.documentId)),
      )
      intervals.delete(event.documentId)
    }
  }
  for (const shown of intervals.values())
    checkingVisibleMs += Math.max(0, shellReady - Math.max(start, shown))
  const longTasks = events.filter(
    (e) => e.kind === "long_task" && e.at >= start && e.at < shellReady,
  )
  const api = traffic.filter((t) => t.path.startsWith("/api/"))
  return {
    checkingVisibleMs: Math.round(checkingVisibleMs),
    documentCount: events.filter((e) => e.kind === "document").length,
    apiRequestCount: api.length,
    sessionReadCount: api.filter((t) => t.path === "/api/auth/me").length,
    deniedReads: api
      .filter((t) => t.status === 401)
      .map((t) => ({
        path: t.path.split("?")[0],
        status: t.status,
        durationMs: t.durationMs,
        errorCode: t.errorCode ?? "unknown",
        requestId: t.requestId ?? null,
      })),
    longTasks: {
      count: longTasks.length,
      totalMs: Math.round(longTasks.reduce((sum, t) => sum + t.duration, 0)),
      maxMs: Math.round(Math.max(0, ...longTasks.map((t) => t.duration))),
    },
  }
}
