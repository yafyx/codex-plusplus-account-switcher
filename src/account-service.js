const { ok, fail, errorMessage, stringifyError } = require("./utils");
const {
  nodeDeps,
  codexAuthPaths,
  normalizeAccountName,
  accountPath,
  ensureDir,
  pathExists,
} = require("./node-utils");

function createAccountService(api) {
  return {
    async handle(message) {
      const action = message?.action;
      try {
        api.log?.info?.(`[account-switcher] action ${String(action)}`);
        if (action === "state") return ok(await readState());
        if (action === "save") return ok(await saveCurrentAccount(message?.name));
        if (action === "switch") return ok(await switchAccount(message?.name, api));
        if (action === "delete") return ok(await deleteAccount(message?.name));
        if (action === "clear-active") return ok(await clearActiveAuth(api));
        if (action === "refresh-usage") return ok(await refreshActiveUsage(api));
        if (action === "relaunch") return ok(await relaunchCodex(api));
        return fail(`Unknown account action: ${String(action)}`);
      } catch (error) {
        api.log.warn("[account-switcher] action failed", stringifyError(error));
        return fail(errorMessage(error));
      }
    },
  };
}

async function readState(extra = {}) {
  const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
  await ensureAutosavedActiveAccount();
  const accounts = await listAccountNames();
  const current = await getCurrentAccountName(accounts);
  const hasActiveAuth = await pathExists(AUTH_PATH);
  const accountEmails = await readAccountEmails(accounts);
  const accountUsage = await readAccountUsage(accounts);
  return {
    accounts,
    accountEmails,
    accountUsage,
    current,
    hasActiveAuth,
    paths: {
      auth: AUTH_PATH,
      accountsDir: ACCOUNTS_DIR,
      current: CURRENT_NAME_PATH,
    },
    ...extra,
  };
}

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
  const fiveHour = normalizeUsageWindow(snapshot.fiveHour);
  const weekly = normalizeUsageWindow(snapshot.weekly);
  if (!fiveHour && !weekly) return null;
  const at = Number(snapshot.at);
  return {
    fiveHour,
    weekly,
    at: Number.isFinite(at) ? at : Date.now(),
  };
}

function normalizeUsageWindow(window) {
  if (!window || typeof window !== "object") return null;
  const pct = Number(window.pct);
  if (!Number.isFinite(pct)) return null;
  return {
    label: typeof window.label === "string" && window.label ? window.label : null,
    pct: Math.max(0, Math.min(100, Math.round(pct))),
    resetAt: typeof window.resetAt === "string" && window.resetAt ? window.resetAt : null,
  };
}

async function readAccountEmails(accounts) {
  const entries = await Promise.all(
    accounts.map(async (name) => [name, await readAccountEmail(accountPath(name))]),
  );
  return Object.fromEntries(entries.filter(([, email]) => email));
}

async function readAccountEmail(filePath) {
  const { fsp } = nodeDeps();
  try {
    const auth = JSON.parse(await fsp.readFile(filePath, "utf8"));
    return emailFromAuth(auth);
  } catch {
    return null;
  }
}

function emailFromAuth(auth) {
  const direct = auth?.email || auth?.user?.email || auth?.account?.email;
  if (typeof direct === "string" && direct.includes("@")) return direct;

  const idToken = auth?.tokens?.id_token;
  if (typeof idToken !== "string") return null;
  const [, payload] = idToken.split(".");
  if (!payload) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof claims.email === "string" && claims.email.includes("@") ? claims.email : null;
  } catch {
    return null;
  }
}

async function listAccountNames() {
  const { fsp } = nodeDeps();
  const { ACCOUNTS_DIR } = codexAuthPaths();
  if (!(await pathExists(ACCOUNTS_DIR))) return [];
  const entries = await fsp.readdir(ACCOUNTS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/i, ""))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

async function getCurrentAccountName(accounts) {
  const { fsp, path } = nodeDeps();
  const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
  if (!(await pathExists(AUTH_PATH))) return null;
  const matched = await findMatchingAccountByContents(accounts);
  if (matched) return matched;

  try {
    const raw = await fsp.readFile(CURRENT_NAME_PATH, "utf8");
    const name = raw.trim();
    if (name && accounts.includes(name)) return name;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  if (!(await pathExists(AUTH_PATH))) return null;
  try {
    const stat = await fsp.lstat(AUTH_PATH);
    if (stat.isSymbolicLink()) {
      const target = await fsp.readlink(AUTH_PATH);
      const resolved = path.resolve(path.dirname(AUTH_PATH), target);
      const relative = path.relative(path.resolve(ACCOUNTS_DIR), resolved);
      if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
        return path.basename(resolved).replace(/\.json$/i, "");
      }
    }
  } catch {
    /* fall through to content matching */
  }

  return null;
}

async function findMatchingAccountByContents(accounts) {
  const { fsp } = nodeDeps();
  const { AUTH_PATH } = codexAuthPaths();
  let active;
  try {
    active = await fsp.readFile(AUTH_PATH, "utf8");
  } catch {
    return null;
  }

  for (const name of accounts) {
    try {
      const saved = await fsp.readFile(accountPath(name), "utf8");
      if (saved === active) return name;
    } catch {
      /* ignore unreadable snapshots */
    }
  }
  return null;
}

async function saveCurrentAccount(rawName) {
  const { fsp } = nodeDeps();
  const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
  const name = normalizeAccountName(rawName);
  if (!(await pathExists(AUTH_PATH))) {
    throw new Error(`No active Codex auth file found at ${AUTH_PATH}`);
  }
  await ensureDir(ACCOUNTS_DIR);
  await fsp.copyFile(AUTH_PATH, accountPath(name));
  await fsp.writeFile(CURRENT_NAME_PATH, `${name}\n`, "utf8");
  return readState({ notice: `Saved current account as ${name}.` });
}

async function refreshActiveUsage(api) {
  const accounts = await listAccountNames();
  const current = await getCurrentAccountName(accounts);
  if (!current) return readState();
  const snapshot = await fetchActiveUsageSnapshot(api);
  await writeAccountUsage(current, snapshot);
  return readState();
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
  const resetAt = formatUsageResetAt(window.reset_at, Number(window.limit_window_seconds) >= 86400);
  return {
    label,
    pct: Math.round(Math.min(Math.max(100 - used, 0), 100)),
    resetAt,
  };
}

function formatUsageResetAt(epochSeconds, includeDay) {
  const seconds = Number(epochSeconds);
  if (!Number.isFinite(seconds)) return null;
  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleTimeString(undefined, {
    ...(includeDay ? { weekday: "short" } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
}

async function ensureAutosavedActiveAccount() {
  const { fsp } = nodeDeps();
  const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
  if (!(await pathExists(AUTH_PATH))) return null;

  const accounts = await listAccountNames();
  const matched = await findMatchingAccountByContents(accounts);
  if (matched) {
    await fsp.writeFile(CURRENT_NAME_PATH, `${matched}\n`, "utf8");
    return matched;
  }

  await ensureDir(ACCOUNTS_DIR);
  const name = await nextAvailableAccountName("account");
  await fsp.copyFile(AUTH_PATH, accountPath(name));
  await fsp.writeFile(CURRENT_NAME_PATH, `${name}\n`, "utf8");
  return name;
}

async function nextAvailableAccountName(baseName) {
  const accounts = new Set(await listAccountNames());
  if (!accounts.has(baseName)) return baseName;
  for (let index = 2; index < 10_000; index += 1) {
    const name = `${baseName}-${index}`;
    if (!accounts.has(name)) return name;
  }
  throw new Error("Could not find an available account name.");
}

async function switchAccount(rawName, api) {
  const { fsp } = nodeDeps();
  const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
  const name = normalizeAccountName(rawName);
  const source = accountPath(name);
  if (!(await pathExists(source))) throw new Error(`Saved account not found: ${name}`);
  await ensureDir(CODEX_DIR);
  await fsp.copyFile(source, AUTH_PATH);
  await fsp.writeFile(CURRENT_NAME_PATH, `${name}\n`, "utf8");
  api?.log?.info?.(`[account-switcher] switched auth file to ${name}; app relaunch required`);
  return readState({
    notice: `Switched to ${name}. Relaunching Codex.`,
    requiresAppRelaunch: true,
  });
}

async function deleteAccount(rawName) {
  const { fsp } = nodeDeps();
  const { CURRENT_NAME_PATH } = codexAuthPaths();
  const name = normalizeAccountName(rawName);
  await fsp.rm(accountPath(name), { force: true });

  // Read CURRENT_NAME_PATH directly; calling getCurrentAccountName([]) would
  // always return null because the empty accounts list never matches anything.
  try {
    const raw = await fsp.readFile(CURRENT_NAME_PATH, "utf8");
    if (raw.trim() === name) {
      await fsp.rm(CURRENT_NAME_PATH, { force: true });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    // File doesn't exist — nothing to clear.
  }

  return readState({ notice: `Removed saved account ${name}.` });
}

async function clearActiveAuth(api) {
  const { fsp, path } = nodeDeps();
  const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
  await ensureDir(CODEX_DIR);
  if (await pathExists(AUTH_PATH)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fsp.copyFile(AUTH_PATH, path.join(CODEX_DIR, `auth.account-switcher-backup-${stamp}.json`));
    await fsp.rm(AUTH_PATH, { force: true });
  }
  await fsp.rm(CURRENT_NAME_PATH, { force: true });
  api?.log?.info?.("[account-switcher] cleared active auth file; app relaunch required");
  return readState({
    notice: "Session cleared. Relaunching Codex for sign-in.",
    requiresAppRelaunch: true,
  });
}

async function relaunchCodex(api) {
  api?.log?.info?.("[account-switcher] relaunch requested");
  const electronRequire = eval("require");
  const { app } = electronRequire("electron");
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 100);
  return readState({ notice: "Relaunching Codex..." });
}

module.exports = { createAccountService };
