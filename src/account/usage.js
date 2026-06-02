const { nodeDeps, codexAuthPaths, ensureDir } = require("../node-utils");

async function readAccountUsage(accounts) {
  const { fsp } = nodeDeps();
  const { USAGE_CACHE_PATH } = codexAuthPaths();
  let raw;
  try {
    raw = JSON.parse(await fsp.readFile(USAGE_CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    accounts
      .map((name) => [name, normalizeUsageSnapshot(raw[name])])
      .filter(([, usage]) => usage),
  );
}

async function writeAccountUsage(name, snapshot) {
  const { fsp } = nodeDeps();
  const { CODEX_DIR, USAGE_CACHE_PATH } = codexAuthPaths();
  const usage = normalizeUsageSnapshot(snapshot);
  if (!usage) return false;
  let cache = {};
  try {
    const raw = JSON.parse(await fsp.readFile(USAGE_CACHE_PATH, "utf8"));
    if (raw && typeof raw === "object" && !Array.isArray(raw)) cache = raw;
  } catch {
    /* start a new cache */
  }
  cache[name] = usage;
  await ensureDir(CODEX_DIR);
  await fsp.writeFile(USAGE_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  return true;
}

function normalizeUsageSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const at = Number(snapshot.at);
  const snapshotAt = Number.isFinite(at) ? at : Date.now();
  const fiveHour = normalizeUsageWindow(snapshot.fiveHour, snapshotAt);
  const weekly = normalizeUsageWindow(snapshot.weekly, snapshotAt);
  if (!fiveHour && !weekly) return null;
  return {
    fiveHour,
    weekly,
    at: snapshotAt,
  };
}

function normalizeUsageWindow(window, snapshotAt = Date.now()) {
  if (!window || typeof window !== "object") return null;
  const pct = Number(window.pct);
  if (!Number.isFinite(pct)) return null;
  const resetAt = typeof window.resetAt === "string" && window.resetAt ? window.resetAt : null;
  const resetAtMs = normalizeResetAtMs(window.resetAtMs) || inferResetAtMs(resetAt, snapshotAt);
  if (resetAtMs && resetAtMs <= Date.now()) {
    return {
      label: typeof window.label === "string" && window.label ? window.label : null,
      pct: 100,
      resetAt: null,
      resetAtMs: null,
      projected: true,
    };
  }
  const normalized = {
    label: typeof window.label === "string" && window.label ? window.label : null,
    pct: Math.max(0, Math.min(100, Math.round(pct))),
    resetAt,
    resetAtMs,
  };
  if (window.projected === true) normalized.projected = true;
  return normalized;
}

function normalizeResetAtMs(value) {
  const resetAtMs = Number(value);
  if (!Number.isFinite(resetAtMs) || resetAtMs <= 0) return null;
  return resetAtMs;
}

function inferResetAtMs(resetAt, snapshotAt) {
  if (typeof resetAt !== "string" || !resetAt.trim() || !Number.isFinite(snapshotAt)) return null;
  const weekday = parseWeekday(resetAt);
  const time = parseClockTime(resetAt);
  if (!time) return null;

  const date = new Date(snapshotAt);
  date.setHours(time.hours, time.minutes, 0, 0);

  if (weekday !== null) {
    const dayDelta = (weekday - date.getDay() + 7) % 7;
    date.setDate(date.getDate() + dayDelta);
  }

  if (date.getTime() < snapshotAt - 60_000) {
    date.setDate(date.getDate() + (weekday === null ? 1 : 7));
  }

  const inferred = date.getTime();
  return Number.isFinite(inferred) ? inferred : null;
}

function parseWeekday(value) {
  const match = /\b(sun|mon|tue|wed|thu|fri|sat)\b/i.exec(value);
  if (!match) return null;
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(match[1].toLowerCase());
}

function parseClockTime(value) {
  const match = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(value);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }
  const suffix = match[3]?.toLowerCase();
  if (suffix) {
    if (hours < 1 || hours > 12) return null;
    if (hours === 12) hours = 0;
    if (suffix === "pm") hours += 12;
  } else if (hours > 23) {
    return null;
  }
  return { hours, minutes };
}

async function fetchActiveUsageSnapshot(api) {
  if (typeof api?.fetchActiveUsage === "function") {
    return api.fetchActiveUsage();
  }
  const usage = await fetchUsageInCodexWebview();
  return snapshotFromUsagePayload(usage);
}

async function fetchUsageInCodexWebview() {
  const electronRequire = eval("require");
  const { webContents } = electronRequire("electron");
  const candidates = webContents
    .getAllWebContents()
    .filter((wc) => {
      const url = wc.getURL();
      return !wc.isDestroyed() && (url.startsWith("app://") || url.includes("codex"));
    });

  let lastError = null;
  for (const wc of candidates) {
    try {
      return await wc.executeJavaScript(usageFetchScript(), true);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No Codex webview available for usage fetch.");
}

function usageFetchScript() {
  return `(() => new Promise((resolve, reject) => {
    const bridge = window.electronBridge;
    if (typeof bridge?.sendMessageFromView !== "function") {
      reject(new Error("electronBridge unavailable"));
      return;
    }
    const hostId = new URL(window.location.href).searchParams.get("hostId")?.trim() || "local";
    const requestId = "account-switcher-usage-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    let done = false;
    const cleanup = () => {
      done = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
    const finish = (fn, value) => {
      if (done) return;
      cleanup();
      fn(value);
    };
    const onMessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object" || data.type !== "fetch-response" || data.requestId !== requestId) return;
      if (data.responseType === "success") {
        try {
          const body = JSON.parse(data.bodyJsonString);
          if (data.status >= 200 && data.status < 300) finish(resolve, body);
          else finish(reject, new Error("HTTP " + data.status));
        } catch (error) {
          finish(reject, error);
        }
      } else {
        finish(reject, new Error(data.error || "fetch failed"));
      }
    };
    const timer = window.setTimeout(() => {
      bridge.sendMessageFromView({ type: "cancel-fetch", requestId }).catch(() => {});
      finish(reject, new Error("usage request timed out"));
    }, 10000);
    window.addEventListener("message", onMessage);
    bridge.sendMessageFromView({
      type: "fetch",
      hostId,
      requestId,
      method: "GET",
      url: "/wham/usage",
    }).catch((error) => finish(reject, error));
  }))();`;
}

function snapshotFromUsagePayload(payload) {
  const windows = collectUsageWindows(payload);
  const five = pickClosestUsageWindow(windows, 300, (minutes) => minutes > 0 && minutes < 1440);
  const weekly = pickClosestUsageWindow(windows, 7 * 24 * 60, (minutes) => minutes >= 1440);
  return {
    fiveHour: usageWindowSnapshot(five, "5h"),
    weekly: usageWindowSnapshot(weekly, "Weekly"),
    at: Date.now(),
  };
}

function collectUsageWindows(value, out = [], seen = new WeakSet()) {
  if (!value || typeof value !== "object") return out;
  if (seen.has(value)) return out;
  seen.add(value);
  if ("used_percent" in value && "limit_window_seconds" in value && "reset_at" in value) {
    out.push(value);
  }
  const values = Array.isArray(value) ? value : Object.values(value);
  for (const item of values) collectUsageWindows(item, out, seen);
  return out;
}

function pickClosestUsageWindow(windows, targetMinutes, predicate) {
  let best = null;
  let bestDistance = Infinity;
  for (const window of windows) {
    const minutes = Number(window?.limit_window_seconds) / 60;
    if (!Number.isFinite(minutes) || !predicate(minutes)) continue;
    const distance = Math.abs(minutes - targetMinutes);
    if (!best || distance < bestDistance) {
      best = window;
      bestDistance = distance;
    }
  }
  return best;
}

function usageWindowSnapshot(window, label) {
  if (!window || typeof window !== "object") return null;
  const used = Number(window.used_percent);
  if (!Number.isFinite(used)) return null;
  const resetAtMs = normalizeResetAtMs(Number(window.reset_at) * 1000);
  const resetAt = formatUsageResetAt(resetAtMs, Number(window.limit_window_seconds) >= 86400);
  return {
    label,
    pct: Math.round(Math.min(Math.max(100 - used, 0), 100)),
    resetAt,
    resetAtMs,
  };
}

function formatUsageResetAt(epochMs, includeDay) {
  const date = new Date(epochMs);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleTimeString(undefined, {
    ...(includeDay ? { weekday: "short" } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
}

module.exports = {
  readAccountUsage,
  writeAccountUsage,
  normalizeUsageSnapshot,
  normalizeUsageWindow,
  fetchActiveUsageSnapshot,
  snapshotFromUsagePayload,
};
