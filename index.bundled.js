var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/constants.js
var require_constants = __commonJS({
  "src/constants.js"(exports2, module2) {
    var GLOBAL_SERVICE_KEY2 = "__codexpp_account_switcher_service__";
    var IPC_HANDLER_KEY2 = "__codexpp_account_switcher_ipc_handler__";
    var IPC_CHANNEL2 = "account-switcher";
    var ACCOUNT_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
    module2.exports = { GLOBAL_SERVICE_KEY: GLOBAL_SERVICE_KEY2, IPC_HANDLER_KEY: IPC_HANDLER_KEY2, IPC_CHANNEL: IPC_CHANNEL2, ACCOUNT_NAME_PATTERN };
  }
});

// src/utils.js
var require_utils = __commonJS({
  "src/utils.js"(exports2, module2) {
    function ok(state) {
      return { ok: true, state };
    }
    function fail(error) {
      return { ok: false, error };
    }
    function errorMessage(error) {
      return error instanceof Error ? error.message : String(error);
    }
    function stringifyError(error) {
      return error instanceof Error ? error.stack || error.message : String(error);
    }
    module2.exports = { ok, fail, errorMessage, stringifyError };
  }
});

// src/i18n.js
var require_i18n = __commonJS({
  "src/i18n.js"(exports2, module2) {
    var STRINGS = {
      "accounts.title": "Accounts",
      "accounts.configure": "Configure accounts",
      "accounts.emptySaved": "No saved accounts yet.",
      "accounts.emptyActive": "No active session. Relaunch and sign in.",
      "accounts.loading": "Loading saved accounts...",
      "accounts.switching": "Switching account...",
      "accounts.preparingSignIn": "Preparing sign-in...",
      "accounts.selected": "selected account",
      "accounts.switchedRelaunching": "Switched to {email}. Relaunching Codex...",
      "accounts.sessionClearedRelaunching": "Session cleared. Relaunching Codex for sign-in...",
      "accounts.relaunchFailed": "Relaunch failed: {error}",
      "settings.activeSession": "Active session",
      "settings.signedInAs": "Signed in as",
      "settings.unsavedAccount": "Unsaved account",
      "settings.noActiveSession": "No active session",
      "settings.activeAuthDescription": "Codex is using the session stored in ~/.codex/auth.json.",
      "settings.noAuthDescription": "No active auth file exists at ~/.codex/auth.json.",
      "settings.accountSetup": "Account setup",
      "settings.signInAnother": "Sign in to another account",
      "settings.signInAnotherDescription": "Back up the current session, clear auth, and relaunch Codex for sign-in.",
      "settings.startSignIn": "Start sign-in",
      "settings.refreshSaved": "Refresh saved accounts",
      "settings.refreshSavedDescription": "Rescan saved sessions in ~/.codex/auth_accounts.",
      "settings.refresh": "Refresh",
      "settings.savedAccounts": "Saved accounts",
      "settings.noSavedAccounts": "No saved accounts yet",
      "settings.noneFound": "None found",
      "settings.noSavedAccountsDescription": "Use Sign in to another account to create one.",
      "settings.activeInWindow": "Active in this Codex window.",
      "settings.usageUnchecked": "Usage not checked yet.",
      "settings.switch": "Switch",
      "settings.delete": "Delete",
      "settings.removing": "Removing account...",
      "service.saved": "Saved current account as {name}.",
      "service.switched": "Switched to {name}. Relaunching Codex.",
      "service.removed": "Removed saved account {name}.",
      "service.sessionCleared": "Session cleared. Relaunching Codex for sign-in.",
      "service.relaunching": "Relaunching Codex..."
    };
    function t2(key, params = {}) {
      const template = STRINGS[key] || key;
      return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => {
        return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
      });
    }
    module2.exports = { t: t2 };
  }
});

// src/node-utils.js
var require_node_utils = __commonJS({
  "src/node-utils.js"(exports2, module2) {
    var { ACCOUNT_NAME_PATTERN } = require_constants();
    function nodeDeps2() {
      return {
        fs: require("node:fs"),
        fsp: require("node:fs/promises"),
        os: require("node:os"),
        path: require("node:path")
      };
    }
    function codexAuthPaths2() {
      const { os, path } = nodeDeps2();
      const CODEX_DIR = path.join(os.homedir(), ".codex");
      return {
        CODEX_DIR,
        AUTH_PATH: path.join(CODEX_DIR, "auth.json"),
        CONFIG_PATH: path.join(CODEX_DIR, "config.toml"),
        ACCOUNTS_DIR: path.join(CODEX_DIR, "auth_accounts"),
        USAGE_CACHE_PATH: path.join(CODEX_DIR, "auth_accounts_usage.json"),
        CURRENT_NAME_PATH: path.join(CODEX_DIR, "current_account")
      };
    }
    function normalizeAccountName2(rawName) {
      if (typeof rawName !== "string") throw new Error("Account name is required.");
      const name = rawName.trim().replace(/\.json$/i, "");
      if (!ACCOUNT_NAME_PATTERN.test(name)) {
        throw new Error(
          "Use letters, numbers, dots, underscores, or dashes. The name must start with a letter or number."
        );
      }
      return name;
    }
    function accountPath2(name) {
      const { path } = nodeDeps2();
      const { ACCOUNTS_DIR } = codexAuthPaths2();
      return path.join(ACCOUNTS_DIR, `${name}.json`);
    }
    async function ensureDir2(dir) {
      const { fsp } = nodeDeps2();
      await fsp.mkdir(dir, { recursive: true });
    }
    async function pathExists2(target) {
      const { fs, fsp } = nodeDeps2();
      try {
        await fsp.access(target, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    }
    module2.exports = { nodeDeps: nodeDeps2, codexAuthPaths: codexAuthPaths2, normalizeAccountName: normalizeAccountName2, accountPath: accountPath2, ensureDir: ensureDir2, pathExists: pathExists2 };
  }
});

// src/account/auth.js
var require_auth = __commonJS({
  "src/account/auth.js"(exports2, module2) {
    function emailFromAuthString(raw) {
      try {
        return emailFromAuth(JSON.parse(raw));
      } catch {
        return null;
      }
    }
    function emailFromAuth(auth) {
      const direct = auth?.email || auth?.user?.email || auth?.account?.email;
      if (typeof direct === "string" && direct.includes("@")) return direct;
      const claims = claimsFromToken(auth?.tokens?.id_token);
      return typeof claims?.email === "string" && claims.email.includes("@") ? claims.email : null;
    }
    function planFromAuthString(raw) {
      try {
        return planFromAuth(JSON.parse(raw));
      } catch {
        return null;
      }
    }
    function planFromAuth(auth) {
      for (const token of [auth?.tokens?.id_token, auth?.tokens?.access_token]) {
        const plan = claimsFromToken(token)?.["https://api.openai.com/auth"]?.chatgpt_plan_type;
        if (typeof plan === "string" && plan.trim()) return plan.trim().toLowerCase();
      }
      return null;
    }
    function claimsFromToken(token) {
      if (typeof token !== "string") return null;
      const [, payload] = token.split(".");
      if (!payload) return null;
      try {
        return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      } catch {
        return null;
      }
    }
    module2.exports = { emailFromAuthString, emailFromAuth, planFromAuthString, planFromAuth };
  }
});

// src/account/storage.js
var require_storage = __commonJS({
  "src/account/storage.js"(exports2, module2) {
    var {
      nodeDeps: nodeDeps2,
      codexAuthPaths: codexAuthPaths2,
      accountPath: accountPath2,
      ensureDir: ensureDir2,
      pathExists: pathExists2
    } = require_node_utils();
    var { emailFromAuthString } = require_auth();
    async function listAccountNames2() {
      const { fsp } = nodeDeps2();
      const { ACCOUNTS_DIR } = codexAuthPaths2();
      if (!await pathExists2(ACCOUNTS_DIR)) return [];
      const entries = await fsp.readdir(ACCOUNTS_DIR, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name.replace(/\.json$/i, "")).sort((a, b) => a.localeCompare(b, void 0, { sensitivity: "base" }));
    }
    async function getCurrentAccountName2(accounts) {
      const { fsp, path } = nodeDeps2();
      const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths2();
      if (!await pathExists2(AUTH_PATH)) return null;
      const matched = await findMatchingAccountByContents(accounts);
      if (matched) return matched;
      try {
        const raw = await fsp.readFile(CURRENT_NAME_PATH, "utf8");
        const name = raw.trim();
        if (name && accounts.includes(name)) return name;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      if (!await pathExists2(AUTH_PATH)) return null;
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
      }
      return null;
    }
    async function findMatchingAccountByContents(accounts) {
      const { fsp } = nodeDeps2();
      const { AUTH_PATH } = codexAuthPaths2();
      let active;
      try {
        active = await fsp.readFile(AUTH_PATH, "utf8");
      } catch {
        return null;
      }
      for (const name of accounts) {
        try {
          const saved = await fsp.readFile(accountPath2(name), "utf8");
          if (saved === active) return name;
        } catch {
        }
      }
      return null;
    }
    async function accountContentsMatchActive(contents) {
      const { fsp } = nodeDeps2();
      const { AUTH_PATH } = codexAuthPaths2();
      try {
        return await fsp.readFile(AUTH_PATH, "utf8") === contents;
      } catch {
        return false;
      }
    }
    async function ensureAutosavedActiveAccount2() {
      const { fsp } = nodeDeps2();
      const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths2();
      if (!await pathExists2(AUTH_PATH)) return null;
      const accounts = await listAccountNames2();
      const matched = await findMatchingAccountByContents(accounts);
      if (matched) {
        await fsp.writeFile(CURRENT_NAME_PATH, `${matched}
`, "utf8");
        return matched;
      }
      const active = await fsp.readFile(AUTH_PATH, "utf8");
      const sameEmail = await findMatchingAccountByEmail(accounts, active);
      if (sameEmail) {
        await fsp.copyFile(AUTH_PATH, accountPath2(sameEmail));
        await fsp.writeFile(CURRENT_NAME_PATH, `${sameEmail}
`, "utf8");
        return sameEmail;
      }
      await ensureDir2(ACCOUNTS_DIR);
      const name = await nextAvailableAccountName("account");
      await fsp.copyFile(AUTH_PATH, accountPath2(name));
      await fsp.writeFile(CURRENT_NAME_PATH, `${name}
`, "utf8");
      return name;
    }
    async function findMatchingAccountByEmail(accounts, activeContents) {
      const activeEmail = emailFromAuthString(activeContents)?.toLowerCase();
      if (!activeEmail) return null;
      const { fsp } = nodeDeps2();
      const { CURRENT_NAME_PATH } = codexAuthPaths2();
      let current = null;
      try {
        current = (await fsp.readFile(CURRENT_NAME_PATH, "utf8")).trim();
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      const matches = [];
      for (const name of accounts) {
        try {
          const filePath = accountPath2(name);
          const [contents, stat] = await Promise.all([
            fsp.readFile(filePath, "utf8"),
            fsp.stat(filePath)
          ]);
          if (emailFromAuthString(contents)?.toLowerCase() === activeEmail) {
            matches.push({ name, isCurrent: name === current, mtimeMs: stat.mtimeMs });
          }
        } catch {
        }
      }
      matches.sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        if (a.mtimeMs !== b.mtimeMs) return b.mtimeMs - a.mtimeMs;
        return a.name.localeCompare(b.name, void 0, { sensitivity: "base" });
      });
      return matches[0]?.name || null;
    }
    async function nextAvailableAccountName(baseName) {
      const accounts = new Set(await listAccountNames2());
      if (!accounts.has(baseName)) return baseName;
      for (let index = 2; index < 1e4; index += 1) {
        const name = `${baseName}-${index}`;
        if (!accounts.has(name)) return name;
      }
      throw new Error("Could not find an available account name.");
    }
    module2.exports = {
      listAccountNames: listAccountNames2,
      getCurrentAccountName: getCurrentAccountName2,
      findMatchingAccountByContents,
      findMatchingAccountByEmail,
      accountContentsMatchActive,
      ensureAutosavedActiveAccount: ensureAutosavedActiveAccount2,
      nextAvailableAccountName
    };
  }
});

// src/account/usage.js
var require_usage = __commonJS({
  "src/account/usage.js"(exports, module) {
    var { nodeDeps, codexAuthPaths, ensureDir } = require_node_utils();
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
        accounts.map((name) => [name, normalizeUsageSnapshot(raw[name])]).filter(([, usage]) => usage)
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
      }
      cache[name] = usage;
      await ensureDir(CODEX_DIR);
      await fsp.writeFile(USAGE_CACHE_PATH, `${JSON.stringify(cache, null, 2)}
`, "utf8");
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
        at: snapshotAt
      };
    }
    function normalizeUsageWindow(window2, snapshotAt = Date.now()) {
      if (!window2 || typeof window2 !== "object") return null;
      const pct = Number(window2.pct);
      if (!Number.isFinite(pct)) return null;
      const resetAt = typeof window2.resetAt === "string" && window2.resetAt ? window2.resetAt : null;
      const resetAtMs = normalizeResetAtMs(window2.resetAtMs) || inferResetAtMs(resetAt, snapshotAt);
      if (resetAtMs && resetAtMs <= Date.now()) {
        return {
          label: typeof window2.label === "string" && window2.label ? window2.label : null,
          pct: 100,
          resetAt: null,
          resetAtMs: null,
          projected: true
        };
      }
      const normalized = {
        label: typeof window2.label === "string" && window2.label ? window2.label : null,
        pct: Math.max(0, Math.min(100, Math.round(pct))),
        resetAt,
        resetAtMs
      };
      if (window2.projected === true) normalized.projected = true;
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
      if (date.getTime() < snapshotAt - 6e4) {
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
    async function fetchActiveUsageSnapshot(api2) {
      if (typeof api2?.fetchActiveUsage === "function") {
        return api2.fetchActiveUsage();
      }
      const usage = await fetchUsageInCodexWebview();
      return snapshotFromUsagePayload(usage);
    }
    async function fetchUsageInCodexWebview() {
      const electronRequire = eval("require");
      const { webContents } = electronRequire("electron");
      const candidates = webContents.getAllWebContents().filter((wc) => {
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
        at: Date.now()
      };
    }
    function collectUsageWindows(value, out = [], seen = /* @__PURE__ */ new WeakSet()) {
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
      for (const window2 of windows) {
        const minutes = Number(window2?.limit_window_seconds) / 60;
        if (!Number.isFinite(minutes) || !predicate(minutes)) continue;
        const distance = Math.abs(minutes - targetMinutes);
        if (!best || distance < bestDistance) {
          best = window2;
          bestDistance = distance;
        }
      }
      return best;
    }
    function usageWindowSnapshot(window2, label) {
      if (!window2 || typeof window2 !== "object") return null;
      const used = Number(window2.used_percent);
      if (!Number.isFinite(used)) return null;
      const resetAtMs = normalizeResetAtMs(Number(window2.reset_at) * 1e3);
      const resetAt = formatUsageResetAt(resetAtMs, Number(window2.limit_window_seconds) >= 86400);
      return {
        label,
        pct: Math.round(Math.min(Math.max(100 - used, 0), 100)),
        resetAt,
        resetAtMs
      };
    }
    function formatUsageResetAt(epochMs, includeDay) {
      const date = new Date(epochMs);
      if (!Number.isFinite(date.getTime())) return null;
      return date.toLocaleTimeString(void 0, {
        ...includeDay ? { weekday: "short" } : {},
        hour: "numeric",
        minute: "2-digit"
      });
    }
    module.exports = {
      readAccountUsage,
      writeAccountUsage,
      normalizeUsageSnapshot,
      normalizeUsageWindow,
      fetchActiveUsageSnapshot,
      snapshotFromUsagePayload
    };
  }
});

// src/account/state.js
var require_state = __commonJS({
  "src/account/state.js"(exports2, module2) {
    var { nodeDeps: nodeDeps2, codexAuthPaths: codexAuthPaths2, accountPath: accountPath2, pathExists: pathExists2 } = require_node_utils();
    var { emailFromAuthString, planFromAuthString } = require_auth();
    var {
      accountContentsMatchActive,
      ensureAutosavedActiveAccount: ensureAutosavedActiveAccount2,
      getCurrentAccountName: getCurrentAccountName2,
      listAccountNames: listAccountNames2
    } = require_storage();
    var { readAccountUsage: readAccountUsage2 } = require_usage();
    async function readState2(extra = {}) {
      const { AUTH_PATH, ACCOUNTS_DIR, CONFIG_PATH, CURRENT_NAME_PATH } = codexAuthPaths2();
      await ensureAutosavedActiveAccount2();
      const allAccounts = await listAccountNames2();
      const visibleAccounts = await selectVisibleAccounts(allAccounts);
      const accounts = visibleAccounts.map((account) => account.name);
      const current = await getCurrentAccountName2(accounts);
      const hasActiveAuth = await pathExists2(AUTH_PATH);
      const accountEmails = Object.fromEntries(
        visibleAccounts.map(({ name, email }) => [name, email]).filter(([, email]) => email)
      );
      const accountPlans = Object.fromEntries(
        visibleAccounts.map(({ name, plan }) => [name, plan]).filter(([, plan]) => plan)
      );
      const accountUsage = await readAccountUsage2(accounts);
      return {
        accounts,
        accountEmails,
        accountPlans,
        accountUsage,
        current,
        hasActiveAuth,
        paths: {
          auth: AUTH_PATH,
          accountsDir: ACCOUNTS_DIR,
          config: CONFIG_PATH,
          current: CURRENT_NAME_PATH
        },
        ...extra
      };
    }
    async function selectVisibleAccounts(accounts) {
      const details = await Promise.all(accounts.map(readAccountDetails));
      const byIdentity = /* @__PURE__ */ new Map();
      for (const detail of details) {
        const key = detail.email ? `email:${detail.email.toLowerCase()}` : `name:${detail.name}`;
        const existing = byIdentity.get(key);
        if (!existing || compareAccountPreference(detail, existing) < 0) {
          byIdentity.set(key, detail);
        }
      }
      return Array.from(byIdentity.values()).sort(
        (a, b) => a.name.localeCompare(b.name, void 0, { sensitivity: "base" })
      );
    }
    async function readAccountDetails(name) {
      const { fsp } = nodeDeps2();
      let raw = null;
      let mtimeMs = 0;
      try {
        const filePath = accountPath2(name);
        const [contents, stat] = await Promise.all([
          fsp.readFile(filePath, "utf8"),
          fsp.stat(filePath)
        ]);
        raw = contents;
        mtimeMs = stat.mtimeMs;
      } catch {
      }
      return {
        name,
        email: raw ? emailFromAuthString(raw) : null,
        plan: raw ? planFromAuthString(raw) : null,
        isActive: raw ? await accountContentsMatchActive(raw) : false,
        mtimeMs
      };
    }
    function compareAccountPreference(left, right) {
      if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
      if (left.mtimeMs !== right.mtimeMs) return right.mtimeMs - left.mtimeMs;
      return left.name.localeCompare(right.name, void 0, { sensitivity: "base" });
    }
    module2.exports = { readState: readState2, selectVisibleAccounts };
  }
});

// src/account/config.js
var require_config = __commonJS({
  "src/account/config.js"(exports2, module2) {
    var { nodeDeps: nodeDeps2, codexAuthPaths: codexAuthPaths2, ensureDir: ensureDir2 } = require_node_utils();
    async function saveAuthSnapshotWithCurrentBaseUrl2(sourcePath, targetPath) {
      const { fsp } = nodeDeps2();
      const raw = await fsp.readFile(sourcePath, "utf8");
      let auth;
      try {
        auth = JSON.parse(raw);
      } catch {
        await fsp.writeFile(targetPath, raw, "utf8");
        return;
      }
      const currentBaseUrl = await readCurrentOpenAIBaseUrl();
      if (isApiKeyAuth(auth) && currentBaseUrl && !accountOpenAIBaseUrl(auth)) {
        auth.base_url = currentBaseUrl;
        await fsp.writeFile(targetPath, `${JSON.stringify(auth, null, 2)}
`, "utf8");
        return;
      }
      await fsp.writeFile(targetPath, raw, "utf8");
    }
    async function readAuthJson2(filePath, label) {
      const { fsp } = nodeDeps2();
      const raw = await fsp.readFile(filePath, "utf8");
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error(`${label} is not valid JSON.`);
      }
    }
    async function syncOpenAIBaseUrlForAccount2(auth) {
      if (!isApiKeyAuth(auth)) {
        await setTopLevelOpenAIBaseUrl2(null);
        return;
      }
      const baseUrl = accountOpenAIBaseUrl(auth);
      if (baseUrl) await setTopLevelOpenAIBaseUrl2(baseUrl);
    }
    function isApiKeyAuth(auth) {
      return auth?.auth_mode === "apikey" || !!auth?.OPENAI_API_KEY;
    }
    function accountOpenAIBaseUrl(auth) {
      if (!isApiKeyAuth(auth)) return null;
      for (const key of ["openai_base_url", "base_url", "OPENAI_BASE_URL"]) {
        const baseUrl = normalizeBaseUrl(auth?.[key]);
        if (baseUrl) return baseUrl;
      }
      return null;
    }
    function normalizeBaseUrl(value) {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    async function readCurrentOpenAIBaseUrl() {
      const { fsp } = nodeDeps2();
      const { CONFIG_PATH } = codexAuthPaths2();
      try {
        return readTopLevelTomlString(await fsp.readFile(CONFIG_PATH, "utf8"), "openai_base_url");
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw error;
      }
    }
    async function setTopLevelOpenAIBaseUrl2(baseUrl) {
      const { fsp } = nodeDeps2();
      const { CODEX_DIR, CONFIG_PATH } = codexAuthPaths2();
      await ensureDir2(CODEX_DIR);
      let current = "";
      try {
        current = await fsp.readFile(CONFIG_PATH, "utf8");
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      const next = updateTopLevelTomlString(current, "openai_base_url", baseUrl);
      if (next !== current) {
        await fsp.writeFile(CONFIG_PATH, next, "utf8");
      }
    }
    function updateTopLevelTomlString(raw, key, value) {
      const lines = raw ? raw.replace(/\r\n/g, "\n").split("\n") : [];
      if (lines.length && lines[lines.length - 1] === "") lines.pop();
      const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
      const kept = [];
      let firstTableIndex = null;
      for (const line of lines) {
        const isTableHeader = /^\s*\[/.test(line);
        if (firstTableIndex === null && isTableHeader) firstTableIndex = kept.length;
        if (firstTableIndex === null && keyPattern.test(line)) continue;
        kept.push(line);
      }
      const insertAt = firstTableIndex === null ? kept.length : firstTableIndex;
      if (value) {
        kept.splice(insertAt, 0, `${key} = ${JSON.stringify(value)}`);
      }
      return `${kept.join("\n")}${kept.length ? "\n" : ""}`;
    }
    function readTopLevelTomlString(raw, key) {
      const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*(['"])(.*)\\1\\s*(?:#.*)?$`);
      for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
        if (/^\s*\[/.test(line)) return null;
        const match = line.match(keyPattern);
        if (!match) continue;
        return match[2].trim() || null;
      }
      return null;
    }
    function escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    module2.exports = {
      saveAuthSnapshotWithCurrentBaseUrl: saveAuthSnapshotWithCurrentBaseUrl2,
      readAuthJson: readAuthJson2,
      syncOpenAIBaseUrlForAccount: syncOpenAIBaseUrlForAccount2,
      setTopLevelOpenAIBaseUrl: setTopLevelOpenAIBaseUrl2,
      accountOpenAIBaseUrl
    };
  }
});

// src/account/actions.js
var require_actions = __commonJS({
  "src/account/actions.js"(exports, module) {
    var { t } = require_i18n();
    var {
      nodeDeps,
      codexAuthPaths,
      normalizeAccountName,
      accountPath,
      ensureDir,
      pathExists
    } = require_node_utils();
    var { readState } = require_state();
    var {
      ensureAutosavedActiveAccount,
      getCurrentAccountName,
      listAccountNames
    } = require_storage();
    var { fetchActiveUsageSnapshot, writeAccountUsage } = require_usage();
    var {
      readAuthJson,
      saveAuthSnapshotWithCurrentBaseUrl,
      setTopLevelOpenAIBaseUrl,
      syncOpenAIBaseUrlForAccount
    } = require_config();
    var relaunchScheduled = false;
    var MAC_APP_EXEC_MARKER = ".app/Contents/MacOS/";
    var MAC_REOPEN_DELAY_SECONDS = "1";
    var MAC_REOPEN_SCRIPT = 'sleep "$1"; exec /usr/bin/open -n "$2"';
    async function saveCurrentAccount(rawName) {
      const { fsp } = nodeDeps();
      const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
      const name = normalizeAccountName(rawName);
      if (!await pathExists(AUTH_PATH)) {
        throw new Error(`No active Codex auth file found at ${AUTH_PATH}`);
      }
      await ensureDir(ACCOUNTS_DIR);
      await saveAuthSnapshotWithCurrentBaseUrl(AUTH_PATH, accountPath(name));
      await fsp.writeFile(CURRENT_NAME_PATH, `${name}
`, "utf8");
      return readState({ notice: t("service.saved", { name }) });
    }
    async function switchAccount(rawName, api2) {
      const { fsp } = nodeDeps();
      const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
      const name = normalizeAccountName(rawName);
      const source = accountPath(name);
      if (!await pathExists(source)) throw new Error(`Saved account not found: ${name}`);
      await ensureDir(CODEX_DIR);
      await ensureAutosavedActiveAccount();
      try {
        const account = await readAuthJson(source, `Saved account ${name}`);
        await syncOpenAIBaseUrlForAccount(account);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api2?.log?.warn?.(`[account-switcher] skipped base URL sync for ${name}: ${message}`);
      }
      await fsp.copyFile(source, AUTH_PATH);
      await fsp.writeFile(CURRENT_NAME_PATH, `${name}
`, "utf8");
      api2?.log?.info?.(`[account-switcher] switched auth file to ${name}; scheduling app relaunch`);
      scheduleCodexRelaunch(api2, 0);
      return readState({
        notice: t("service.switched", { name }),
        requiresAppRelaunch: true
      });
    }
    async function deleteAccount(rawName) {
      const { fsp } = nodeDeps();
      const { CURRENT_NAME_PATH } = codexAuthPaths();
      const name = normalizeAccountName(rawName);
      await fsp.rm(accountPath(name), { force: true });
      try {
        const raw = await fsp.readFile(CURRENT_NAME_PATH, "utf8");
        if (raw.trim() === name) {
          await fsp.rm(CURRENT_NAME_PATH, { force: true });
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      return readState({ notice: t("service.removed", { name }) });
    }
    async function clearActiveAuth(api2) {
      const { fsp, path } = nodeDeps();
      const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
      await ensureDir(CODEX_DIR);
      await setTopLevelOpenAIBaseUrl(null);
      if (await pathExists(AUTH_PATH)) {
        const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
        await fsp.copyFile(AUTH_PATH, path.join(CODEX_DIR, `auth.account-switcher-backup-${stamp}.json`));
        await fsp.rm(AUTH_PATH, { force: true });
      }
      await fsp.rm(CURRENT_NAME_PATH, { force: true });
      api2?.log?.info?.("[account-switcher] cleared active auth file; scheduling app relaunch");
      scheduleCodexRelaunch(api2, 0);
      return readState({
        notice: t("service.sessionCleared"),
        requiresAppRelaunch: true
      });
    }
    async function refreshActiveUsage(api2) {
      const accounts = await listAccountNames();
      const current = await getCurrentAccountName(accounts);
      if (!current) return readState();
      const snapshot = await fetchActiveUsageSnapshot(api2);
      await writeAccountUsage(current, snapshot);
      return readState();
    }
    async function relaunchCodex(api2) {
      api2?.log?.info?.("[account-switcher] relaunch requested");
      scheduleCodexRelaunch(api2, 100);
      return readState({ notice: t("service.relaunching") });
    }
    function scheduleCodexRelaunch(api2, delayMs) {
      if (relaunchScheduled) return;
      const app = electronApp(api2);
      const schedule = typeof api2?.setTimeout === "function" ? api2.setTimeout.bind(api2) : setTimeout;
      relaunchScheduled = true;
      schedule(() => {
        relaunchScheduled = false;
        relaunchCodexNow(api2, app);
      }, delayMs);
    }
    function relaunchCodexNow(api2, app) {
      if (!scheduleMacCodexReopen(api2)) {
        app.relaunch();
      }
      app.exit(0);
    }
    function scheduleMacCodexReopen(api2) {
      const platform = api2?.platform || process.platform;
      if (platform !== "darwin") return false;
      const appRoot = inferMacAppRoot(api2?.execPath || process.execPath);
      if (!appRoot) {
        api2?.log?.warn?.("[account-switcher] unable to infer macOS app root; using Electron relaunch");
        return false;
      }
      try {
        const spawn = api2?.spawn || require("node:child_process").spawn;
        const child = spawn(
          "/bin/sh",
          ["-c", MAC_REOPEN_SCRIPT, "codex-account-switcher-relaunch", MAC_REOPEN_DELAY_SECONDS, appRoot],
          { detached: true, stdio: "ignore" }
        );
        child.unref();
        api2?.log?.info?.(`[account-switcher] scheduled detached macOS reopen for ${appRoot}`);
        return true;
      } catch (error) {
        api2?.log?.warn?.(`[account-switcher] unable to schedule detached macOS reopen: ${String(error)}`);
        return false;
      }
    }
    function inferMacAppRoot(execPath) {
      if (typeof execPath !== "string") return null;
      const index = execPath.indexOf(MAC_APP_EXEC_MARKER);
      return index >= 0 ? execPath.slice(0, index + ".app".length) : null;
    }
    function electronApp(api) {
      if (api?.app) return api.app;
      const electronRequire = eval("require");
      return electronRequire("electron").app;
    }
    module.exports = {
      saveCurrentAccount,
      switchAccount,
      deleteAccount,
      clearActiveAuth,
      refreshActiveUsage,
      relaunchCodex
    };
  }
});

// src/account/service.js
var require_service = __commonJS({
  "src/account/service.js"(exports2, module2) {
    var { ok, fail, errorMessage, stringifyError } = require_utils();
    var {
      clearActiveAuth: clearActiveAuth2,
      deleteAccount: deleteAccount2,
      refreshActiveUsage: refreshActiveUsage2,
      relaunchCodex: relaunchCodex2,
      saveCurrentAccount: saveCurrentAccount2,
      switchAccount: switchAccount2
    } = require_actions();
    var { readState: readState2 } = require_state();
    function createAccountService2(api2) {
      return {
        async handle(message) {
          const action = message?.action;
          try {
            api2.log?.info?.(`[account-switcher] action ${String(action)}`);
            if (action === "state") return ok(await readState2());
            if (action === "save") return ok(await saveCurrentAccount2(message?.name));
            if (action === "switch") return ok(await switchAccount2(message?.name, api2));
            if (action === "delete") return ok(await deleteAccount2(message?.name));
            if (action === "clear-active") return ok(await clearActiveAuth2(api2));
            if (action === "refresh-usage") return ok(await refreshActiveUsage2(api2));
            if (action === "relaunch") return ok(await relaunchCodex2(api2));
            return fail(`Unknown account action: ${String(action)}`);
          } catch (error) {
            api2.log.warn("[account-switcher] action failed", stringifyError(error));
            return fail(errorMessage(error));
          }
        }
      };
    }
    module2.exports = { createAccountService: createAccountService2 };
  }
});

// src/dom-utils.js
var require_dom_utils = __commonJS({
  "src/dom-utils.js"(exports2, module2) {
    function compactText(element) {
      return (element?.textContent || "").replace(/\s+/g, " ").trim();
    }
    function isVisible(element) {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    }
    function findMenuItem(root, pattern) {
      return Array.from(
        root.querySelectorAll('[role="menuitem"], button, [data-radix-collection-item]')
      ).find((element) => {
        return element instanceof HTMLElement && isVisible(element) && pattern.test(compactText(element));
      });
    }
    function protectInteractiveControl(element, options = {}) {
      const preventClickDefault = options.preventClickDefault !== false;
      const stop = (event) => {
        event.stopPropagation();
      };
      element.addEventListener("pointerdown", stop, true);
      element.addEventListener("mousedown", stop, true);
      element.addEventListener("mouseup", stop, true);
      element.addEventListener("keydown", stop, true);
      element.addEventListener(
        "click",
        (event) => {
          if (preventClickDefault) event.preventDefault();
          event.stopPropagation();
        },
        true
      );
    }
    module2.exports = { compactText, isVisible, findMenuItem, protectInteractiveControl };
  }
});

// src/menu-finder.js
var require_menu_finder = __commonJS({
  "src/menu-finder.js"(exports2, module2) {
    var { compactText, isVisible } = require_dom_utils();
    var MENU_CONTAINER_SELECTOR = '[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]';
    var MENU_COMMAND_SELECTOR = 'button, a, [role="button"], [role="menuitem"]';
    var PERSONAL_ACCOUNT_PATTERN = /\bpersonal account\b/i;
    var USAGE_REMAINING_PATTERN = /\busage remaining\b/i;
    var RATE_LIMITS_PATTERN = /\brate limits(?: remaining)?\b/i;
    function findSettingsAccountMenu() {
      return findAccountMenuByCommands() || findAccountMenuByScopedMarkers() || findAccountMenuByPageMarker() || findAccountMenuByLegacyMenuText() || findAccountMenuByUsageItem() || findSidebarAccountMenuByItems();
    }
    function findAccountMenuByCommands() {
      const commands = visibleMenuCommands();
      for (const settings of commands) {
        if (!/\bsettings\b/i.test(compactText(settings))) continue;
        let node = settings.parentElement;
        while (node && node !== document.body && node !== document.documentElement) {
          if (node instanceof HTMLElement && isPlausibleAccountMenu(node)) {
            const hasLogout = commands.some((item) => {
              return item !== settings && node.contains(item) && /\blog out\b/i.test(compactText(item));
            });
            const hasMarker = hasAccountMenuMarker(compactText(node)) || commands.some((item) => node.contains(item) && hasAccountMenuMarker(compactText(item)));
            if (hasLogout && hasMarker) return normalizeMenuContainer(node);
          }
          node = node.parentElement;
        }
      }
      return null;
    }
    function findAccountMenuByScopedMarkers() {
      const containers = document.querySelectorAll(MENU_CONTAINER_SELECTOR);
      for (const container of containers) {
        const menu = normalizeMenuContainer(container);
        if (!(menu instanceof HTMLElement) || !isVisible(menu)) continue;
        const marker = findVisibleTextMatch(menu, PERSONAL_ACCOUNT_PATTERN);
        if (!marker) continue;
        const accountMenu = findAccountMenuContainer(marker);
        if (accountMenu) return accountMenu;
      }
      return null;
    }
    function findAccountMenuByPageMarker() {
      const marker = findVisibleTextMatch(document, PERSONAL_ACCOUNT_PATTERN, "*");
      return marker ? findAccountMenuContainer(marker) : null;
    }
    function findVisibleTextMatch(root, pattern, selector = MENU_COMMAND_SELECTOR) {
      const candidates2 = root.querySelectorAll(selector);
      for (const element of candidates2) {
        if (!(element instanceof HTMLElement) || !isVisible(element)) continue;
        if (element.closest("[data-codexpp-account-switcher]")) continue;
        if (pattern.test(compactText(element))) return element;
      }
      return null;
    }
    function findAccountMenuByLegacyMenuText() {
      const menus = document.querySelectorAll('[role="menu"], [data-radix-menu-content]');
      for (const candidate of menus) {
        if (!(candidate instanceof HTMLElement) || !isVisible(candidate)) continue;
        if (isAccountMenuText(compactText(candidate))) return candidate;
      }
      return null;
    }
    function visibleMenuCommands(root = document) {
      return Array.from(root.querySelectorAll(MENU_COMMAND_SELECTOR)).filter((element) => {
        return element instanceof HTMLElement && isVisible(element) && !element.closest("[data-codexpp-account-switcher]");
      });
    }
    function findAccountMenuContainer(element) {
      const menu = normalizeMenuContainer(element.closest(MENU_CONTAINER_SELECTOR));
      if (menu instanceof HTMLElement && isPlausibleAccountMenu(menu)) {
        const text = compactText(menu);
        if (isAccountMenuText(text)) return menu;
      }
      let node = element.parentElement;
      while (node && node !== document.body && node !== document.documentElement) {
        if (node instanceof HTMLElement && isPlausibleAccountMenu(node) && isAccountMenuText(compactText(node))) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }
    function normalizeMenuContainer(container) {
      if (!(container instanceof HTMLElement)) return null;
      if (!container.matches("[data-radix-popper-content-wrapper]")) return container;
      const content = container.querySelector('[role="menu"], [data-radix-menu-content]');
      return content instanceof HTMLElement ? content : container;
    }
    function isPlausibleAccountMenu(element) {
      if (!isVisible(element)) return false;
      if (element.matches(MENU_CONTAINER_SELECTOR)) return true;
      const rect = element.getBoundingClientRect();
      const width = window.innerWidth || document.documentElement.clientWidth || 0;
      const height = window.innerHeight || document.documentElement.clientHeight || 0;
      if (width > 0 && height > 0 && rect.width >= width * 0.8 && rect.height >= height * 0.8) {
        return false;
      }
      return rect.width <= 720 && rect.height <= 900;
    }
    function isAccountMenuText(text) {
      return /\bsettings\b/i.test(text) && /\blog out\b/i.test(text) && hasAccountMenuMarker(text);
    }
    function hasAccountMenuMarker(text) {
      return PERSONAL_ACCOUNT_PATTERN.test(text) || USAGE_REMAINING_PATTERN.test(text) || RATE_LIMITS_PATTERN.test(text);
    }
    function findAccountMenuByUsageItem() {
      const usageItem = findUsageItem();
      if (!usageItem) return null;
      return findAccountMenuContainer(usageItem);
    }
    function findUsageItem(root = document) {
      const candidates2 = root.querySelectorAll(MENU_COMMAND_SELECTOR);
      for (const element of candidates2) {
        if (!(element instanceof HTMLElement) || !isVisible(element)) continue;
        if (element.closest("[data-codexpp-account-switcher]")) continue;
        const text = compactText(element).toLowerCase();
        if (!USAGE_REMAINING_PATTERN.test(text) && !RATE_LIMITS_PATTERN.test(text)) continue;
        return element;
      }
      return null;
    }
    function findSidebarAccountMenuByItems() {
      const items = Array.from(
        document.querySelectorAll('button, a, [role="menuitem"], [data-radix-collection-item]')
      ).filter((element) => element instanceof HTMLElement && isVisible(element));
      const settings = items.find((element) => /\bsettings\b/i.test(compactText(element)));
      const logout = items.find((element) => /\blog out\b/i.test(compactText(element)));
      if (!settings || !logout) return null;
      let node = settings.parentElement;
      while (node && node !== document.body) {
        if (node.contains(logout)) {
          const text = compactText(node);
          if (isAccountMenuText(text)) {
            return node;
          }
        }
        node = node.parentElement;
      }
      return null;
    }
    module2.exports = {
      RATE_LIMITS_PATTERN,
      USAGE_REMAINING_PATTERN,
      findSettingsAccountMenu,
      hasAccountMenuMarker,
      isAccountMenuText
    };
  }
});

// src/ipc.js
var require_ipc = __commonJS({
  "src/ipc.js"(exports2, module2) {
    var { IPC_CHANNEL: IPC_CHANNEL2 } = require_constants();
    async function invoke(state, action, payload = {}) {
      const result = await state.api.ipc.invoke(IPC_CHANNEL2, { ...payload, action });
      if (!result?.ok) throw new Error(result?.error || "Account switcher action failed.");
      state.lastState = result.state;
      return result.state;
    }
    module2.exports = { invoke };
  }
});

// src/usage-refresh.js
var require_usage_refresh = __commonJS({
  "src/usage-refresh.js"(exports2, module2) {
    var { errorMessage } = require_utils();
    var { invoke } = require_ipc();
    var USAGE_REFRESH_INTERVAL_MS = 6e4;
    function refreshUsageInBackground(state, render) {
      const now = Date.now();
      if (state.usageRefreshInFlight || now - (state.lastUsageRefreshAt || 0) < USAGE_REFRESH_INTERVAL_MS) {
        return;
      }
      state.usageRefreshInFlight = true;
      state.lastUsageRefreshAt = now;
      invoke(state, "refresh-usage").then((accountState) => {
        render(accountState);
      }).catch((error) => {
        state.api.log.warn("[account-switcher] usage refresh failed", errorMessage(error));
      }).finally(() => {
        state.usageRefreshInFlight = false;
      });
    }
    module2.exports = { USAGE_REFRESH_INTERVAL_MS, refreshUsageInBackground };
  }
});

// src/ui-components.js
var require_ui_components = __commonJS({
  "src/ui-components.js"(exports2, module2) {
    var { protectInteractiveControl } = require_dom_utils();
    var PANEL_ROW_LEFT_INSET = 64;
    var MENU_ICON_SLOT_WIDTH = "24px";
    var MENU_ICON_TEXT_GAP = "16px";
    var MENU_ICON_LEFT = "24px";
    function addButtonFeedback(element, styles) {
      const normal = {
        background: element.style.background || element.style.backgroundColor || "transparent",
        color: element.style.color || "",
        transform: element.style.transform || ""
      };
      const apply = (values) => {
        if (values.background != null) element.style.background = values.background;
        if (values.color != null) element.style.color = values.color;
        if (values.transform != null) element.style.transform = values.transform;
      };
      const hover = styles.hover || {};
      const active = styles.active || hover;
      const restore = () => apply(styles.normal || normal);
      element.style.transformOrigin = "center";
      element.style.transition = prefersReducedMotion() ? "background-color 120ms ease, color 120ms ease" : "background-color 120ms ease, color 120ms ease, transform 120ms cubic-bezier(0.23, 1, 0.32, 1)";
      element.addEventListener("pointerenter", () => {
        if (element.disabled) return;
        apply(hover);
      });
      element.addEventListener("pointerleave", restore);
      element.addEventListener("focus", () => {
        if (element.disabled) return;
        apply(hover);
      });
      element.addEventListener("blur", restore);
      element.addEventListener("pointerdown", () => {
        if (element.disabled) return;
        apply(active);
      });
      element.addEventListener("pointerup", () => {
        if (element.disabled) return;
        apply(hover);
      });
      element.addEventListener("pointercancel", restore);
    }
    function prefersReducedMotion() {
      return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    function smallButton(label) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.cssText = "height:24px;border:0;border-radius:6px;padding:0 8px;background:color-mix(in srgb,var(--color-token-text-primary,currentColor) 10%,transparent);color:var(--color-token-text-primary,currentColor);font:inherit;font-size:12px;line-height:1;cursor:pointer;";
      addButtonFeedback(button, {
        hover: {
          background: "color-mix(in srgb,var(--color-token-text-primary,currentColor) 16%,transparent)"
        },
        active: {
          background: "color-mix(in srgb,var(--color-token-text-primary,currentColor) 22%,transparent)",
          transform: prefersReducedMotion() ? "" : "scale(0.97)"
        }
      });
      protectInteractiveControl(button);
      return button;
    }
    function iconButton(label, text) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.setAttribute("aria-label", label);
      button.title = label;
      button.style.cssText = "display:grid;place-items:center;width:22px;height:22px;border:0;border-radius:5px;background:transparent;color:var(--color-token-text-secondary,currentColor);font:inherit;font-size:16px;line-height:1;cursor:pointer;";
      addButtonFeedback(button, {
        hover: {
          background: "color-mix(in srgb,var(--color-token-text-primary,currentColor) 10%,transparent)",
          color: "var(--color-token-text-primary,currentColor)"
        },
        active: {
          background: "color-mix(in srgb,var(--color-token-text-primary,currentColor) 18%,transparent)",
          color: "var(--color-token-text-primary,currentColor)",
          transform: prefersReducedMotion() ? "" : "scale(0.97)"
        }
      });
      protectInteractiveControl(button);
      return button;
    }
    function settingsButton(label) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = "inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-sm text-token-text-primary hover:bg-token-foreground/10 disabled:cursor-default disabled:opacity-50";
      button.style.border = "1px solid color-mix(in srgb, currentColor 14%, transparent)";
      button.style.backgroundColor = "color-mix(in srgb, currentColor 5%, transparent)";
      addButtonFeedback(button, {
        hover: {
          background: "color-mix(in srgb, currentColor 10%, transparent)"
        },
        active: {
          background: "color-mix(in srgb, currentColor 16%, transparent)",
          transform: prefersReducedMotion() ? "" : "scale(0.97)"
        }
      });
      protectInteractiveControl(button);
      return button;
    }
    function settingsSection(title) {
      const section = document.createElement("section");
      section.className = "flex flex-col gap-2";
      const titleRow = document.createElement("div");
      titleRow.className = "flex h-toolbar items-center justify-between gap-2 px-0 py-0";
      const inner = document.createElement("div");
      inner.className = "flex min-w-0 flex-1 flex-col gap-1";
      const heading = document.createElement("div");
      heading.className = "text-base font-medium text-token-text-primary";
      heading.textContent = title;
      inner.appendChild(heading);
      titleRow.appendChild(inner);
      section.appendChild(titleRow);
      return section;
    }
    function settingsCard() {
      const card = document.createElement("div");
      card.className = "border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border";
      card.style.backgroundColor = "var(--color-background-panel, var(--color-token-bg-fog))";
      return card;
    }
    function settingsRowShell() {
      const row = document.createElement("div");
      row.className = "flex items-center justify-between gap-4 p-3";
      return row;
    }
    function settingsInfoRow(titleText, valueText, descriptionText) {
      const row = settingsRowShell();
      const left = document.createElement("div");
      left.className = "flex min-w-0 flex-col gap-1";
      const title = document.createElement("div");
      title.className = "min-w-0 text-sm text-token-text-primary";
      title.textContent = titleText;
      left.appendChild(title);
      if (descriptionText) {
        const desc = document.createElement("div");
        desc.className = "text-token-text-secondary min-w-0 text-sm";
        desc.textContent = descriptionText;
        left.appendChild(desc);
      }
      const value = document.createElement("div");
      value.className = "max-w-[45%] shrink-0 truncate text-right text-sm text-token-text-secondary";
      value.title = valueText;
      value.textContent = valueText;
      row.append(left, value);
      return row;
    }
    function settingsActionRow(titleText, descriptionText, actionText, onClick) {
      const row = settingsRowShell();
      const left = document.createElement("div");
      left.className = "flex min-w-0 flex-col gap-1";
      const title = document.createElement("div");
      title.className = "min-w-0 text-sm text-token-text-primary";
      title.textContent = titleText;
      left.appendChild(title);
      const desc = document.createElement("div");
      desc.className = "text-token-text-secondary min-w-0 text-sm";
      desc.textContent = descriptionText;
      left.appendChild(desc);
      row.appendChild(left);
      const button = settingsButton(actionText);
      bindButtonAction(button, onClick);
      row.appendChild(button);
      return row;
    }
    function bindButtonAction(button, onAction) {
      let lastRun = 0;
      const run = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        const now = Date.now();
        if (now - lastRun < 350) return;
        lastRun = now;
        onAction(event);
      };
      button.addEventListener("pointerup", run);
      button.addEventListener("click", run);
    }
    function settingsStatus(text, isError = false) {
      const status = document.createElement("div");
      status.className = "text-token-text-secondary text-sm";
      status.style.color = isError ? "var(--color-token-text-error, #c2410c)" : "var(--color-token-text-secondary, currentColor)";
      status.textContent = text;
      return status;
    }
    function accountPanelShell(base) {
      const panel = document.createElement("div");
      panel.setAttribute("data-codexpp-account-switcher", "panel");
      panel.setAttribute("role", "presentation");
      panel.style.cssText = [
        "box-sizing:border-box",
        "width:100%",
        "margin:0",
        "padding:0",
        "color:var(--color-token-text-primary,currentColor)",
        "cursor:default",
        "user-select:none"
      ].join(";");
      applyNativeMenuMetrics(panel, base);
      return panel;
    }
    function applyNativeMenuMetrics(panel, base) {
      const metrics = nativeMenuMetrics(base);
      panel.style.setProperty("--codexpp-menu-row-padding-top", metrics.paddingTop);
      panel.style.setProperty("--codexpp-menu-row-padding-right", metrics.paddingRight);
      panel.style.setProperty("--codexpp-menu-row-padding-bottom", metrics.paddingBottom);
      panel.style.setProperty("--codexpp-menu-row-padding-left", metrics.paddingLeft);
      panel.style.setProperty("--codexpp-menu-row-height", metrics.height);
      panel.style.setProperty("--codexpp-menu-row-radius", metrics.borderRadius);
      panel.style.setProperty("--codexpp-menu-icon-left", metrics.iconLeft);
      panel.style.setProperty("--codexpp-menu-icon-slot-width", metrics.iconSlotWidth);
      panel.style.setProperty("--codexpp-menu-icon-gap", metrics.iconGap);
      panel.style.setProperty("--codexpp-menu-text-inset", metrics.textInset);
    }
    function nativeMenuMetrics(base) {
      const fallback = {
        paddingTop: "0px",
        paddingRight: "24px",
        paddingBottom: "0px",
        paddingLeft: "24px",
        height: "40px",
        borderRadius: "8px",
        iconLeft: MENU_ICON_LEFT,
        iconSlotWidth: MENU_ICON_SLOT_WIDTH,
        iconGap: MENU_ICON_TEXT_GAP,
        textInset: PANEL_ROW_LEFT_INSET + "px"
      };
      if (!base || typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
        return fallback;
      }
      const style = window.getComputedStyle(base);
      const rect = typeof base.getBoundingClientRect === "function" ? base.getBoundingClientRect() : null;
      const iconRect = base.querySelector("svg")?.getBoundingClientRect();
      const textRect = firstTextRect(base);
      return {
        paddingTop: cssLengthOr(style.paddingTop, fallback.paddingTop),
        paddingRight: cssLengthOr(style.paddingRight, fallback.paddingRight),
        paddingBottom: cssLengthOr(style.paddingBottom, fallback.paddingBottom),
        paddingLeft: cssLengthOr(style.paddingLeft, fallback.paddingLeft),
        height: rect?.height > 0 ? `${Math.round(rect.height)}px` : fallback.height,
        borderRadius: cssLengthOr(style.borderRadius, fallback.borderRadius),
        iconLeft: rect && iconRect?.width > 0 ? `${Math.round(iconRect.left - rect.left)}px` : fallback.iconLeft,
        iconSlotWidth: iconRect?.width > 0 ? `${Math.round(iconRect.width)}px` : fallback.iconSlotWidth,
        iconGap: MENU_ICON_TEXT_GAP,
        textInset: rect && textRect?.width > 0 ? `${Math.round(textRect.left - rect.left)}px` : fallback.textInset
      };
    }
    function firstTextRect(element) {
      if (typeof document === "undefined" || typeof document.createTreeWalker !== "function") return null;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.textContent?.trim()) {
          const parent = node.parentElement;
          if (!parent?.closest("svg")) {
            const range = document.createRange();
            range.selectNodeContents(node);
            const rect = Array.from(range.getClientRects()).find((item) => item.width > 0 && item.height > 0);
            range.detach?.();
            if (rect) return rect;
          }
        }
        node = walker.nextNode();
      }
      return null;
    }
    function cssLengthOr(value, fallback) {
      return value && value !== "normal" && value !== "auto" && value !== "0px" ? value : fallback;
    }
    function setPanelStatus(panel, text) {
      panel.textContent = "";
      const status = document.createElement("div");
      status.textContent = text;
      status.style.cssText = `font-size:12px;line-height:1.35;color:var(--color-token-text-secondary,currentColor);padding:4px var(--codexpp-menu-row-padding-right,24px) 6px var(--codexpp-menu-text-inset,64px);`;
      panel.appendChild(status);
    }
    function accountDisplayName(accountState, name, options = {}) {
      const email = accountState?.accountEmails?.[name];
      const suffix = accountState?.current === name && options.includeCurrent !== false ? " (current)" : "";
      return email ? `${email}${suffix}` : `${name}${suffix}`;
    }
    function accountUsageSummary(accountState, name) {
      const parts = accountUsageParts(accountState, name).map(usageWindowSummary);
      if (!parts.length) return null;
      return parts.join(" \xB7 ");
    }
    function accountUsageTitle(accountState, name) {
      const parts = accountUsageParts(accountState, name).filter((part) => part.projected);
      if (!parts.length) return "";
      const labels = parts.map((part) => part.label).join(", ");
      return `${labels} reset time has elapsed. Displayed remaining is calculated from the cached reset schedule and updates live when this account is active.`;
    }
    function accountUsageParts(accountState, name) {
      const usage = accountState?.accountUsage?.[name];
      if (!usage || typeof usage !== "object") return [];
      return [
        usageWindowPart(usage.fiveHour, "5h"),
        usageWindowPart(usage.weekly, "Weekly")
      ].filter(Boolean);
    }
    function usageWindowPart(window2, fallbackLabel) {
      if (typeof window2?.pct !== "number") return null;
      const label = window2.label || fallbackLabel;
      const exhausted = window2.pct <= 0;
      const resetAtMs = Number(window2.resetAtMs);
      const hasResetAtMs = Number.isFinite(resetAtMs) && resetAtMs > 0;
      const resetPassed = hasResetAtMs && resetAtMs <= Date.now();
      const part = {
        label,
        pct: window2.pct,
        resetAt: typeof window2.resetAt === "string" && window2.resetAt ? window2.resetAt : null,
        exhausted,
        resetPassed
      };
      if (hasResetAtMs) part.resetAtMs = resetAtMs;
      if (window2.projected === true) part.projected = true;
      return part;
    }
    function usageWindowSummary(part) {
      const reset = part.projected ? " (reset elapsed)" : part.exhausted && part.resetAt ? `, resets ${part.resetAt}` : "";
      return `${part.label} ${part.pct}%${reset}`;
    }
    module2.exports = {
      PANEL_ROW_LEFT_INSET,
      addButtonFeedback,
      smallButton,
      iconButton,
      settingsButton,
      settingsSection,
      settingsCard,
      settingsRowShell,
      settingsInfoRow,
      settingsActionRow,
      settingsStatus,
      bindButtonAction,
      accountPanelShell,
      setPanelStatus,
      accountDisplayName,
      accountUsageParts,
      accountUsageSummary,
      accountUsageTitle,
      prefersReducedMotion
    };
  }
});

// src/ui-account-row.js
var require_ui_account_row = __commonJS({
  "src/ui-account-row.js"(exports2, module2) {
    var {
      accountDisplayName,
      accountUsageParts,
      accountUsageTitle,
      addButtonFeedback,
      bindButtonAction
    } = require_ui_components();
    var { protectInteractiveControl } = require_dom_utils();
    var ACCOUNT_CURRENT_BACKGROUND = "color-mix(in srgb,currentColor 5%,transparent)";
    var ACCOUNT_CURRENT_SHADOW = "inset 0 0 0 1px color-mix(in srgb,currentColor 7%,transparent)";
    function accountRow(accountState, name, onSwitch) {
      const row = document.createElement("button");
      row.type = "button";
      row.title = accountDisplayName(accountState, name, { includeCurrent: false });
      const isCurrent = accountState.current === name;
      if (isCurrent) {
        row.setAttribute("aria-current", "true");
        row.setAttribute("data-codexpp-account-current", "true");
      }
      const normalBackground = isCurrent ? ACCOUNT_CURRENT_BACKGROUND : "transparent";
      const normalShadow = isCurrent ? ACCOUNT_CURRENT_SHADOW : "none";
      row.style.cssText = `box-sizing:border-box;width:100%;min-height:44px;border:0;text-align:left;font:inherit;display:flex;flex-direction:column;justify-content:center;gap:0;border-radius:var(--codexpp-menu-row-radius,8px);margin:0;padding:2px var(--codexpp-menu-row-padding-right,24px) 2px var(--codexpp-menu-text-inset,64px);background:${normalBackground};box-shadow:${normalShadow};color:var(--color-token-text-primary,currentColor);cursor:default;`;
      const titleRow = document.createElement("span");
      titleRow.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr) auto;min-width:0;width:100%;align-items:baseline;column-gap:12px;min-height:20px;";
      const nameText = document.createElement("span");
      nameText.textContent = accountDisplayName(accountState, name, { includeCurrent: false });
      nameText.style.cssText = `display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:1.3;font-weight:${isCurrent ? "500" : "400"};`;
      titleRow.appendChild(nameText);
      const planText = accountPlanText(accountState?.accountPlans?.[name]);
      if (planText) titleRow.appendChild(planText);
      row.appendChild(titleRow);
      const usage = accountUsageParts(accountState, name);
      const details = accountDetailsLine(accountState, name, usage);
      if (details) row.appendChild(details);
      addButtonFeedback(row, {
        normal: { background: normalBackground },
        hover: {
          background: "var(--color-token-list-hover-background, color-mix(in srgb,currentColor 8%,transparent))"
        },
        active: {
          background: "color-mix(in srgb,currentColor 12%,transparent)",
          transform: ""
        }
      });
      protectInteractiveControl(row);
      bindButtonAction(row, () => {
        if (accountState.current === name) return;
        onSwitch(name);
      });
      return row;
    }
    function accountPlanText(plan) {
      const label = accountPlanLabel(plan);
      if (!label) return null;
      const paid = isPaidAccountPlan(plan);
      const accent = "var(--color-token-charts-blue,var(--color-token-text-link-foreground,#0285ff))";
      const text = document.createElement("span");
      text.setAttribute("data-codexpp-account-plan", "");
      text.setAttribute("data-codexpp-account-plan-tone", paid ? "paid" : "free");
      text.setAttribute("aria-label", `ChatGPT ${label} plan`);
      text.title = `ChatGPT ${label} plan`;
      text.textContent = label;
      text.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        "flex:0 0 auto",
        "max-width:96px",
        "min-width:0",
        "overflow:hidden",
        "text-overflow:ellipsis",
        "border-radius:999px",
        "padding:1px 6px",
        paid ? `background:color-mix(in srgb,${accent} 14%,transparent)` : "background:color-mix(in srgb,currentColor 5%,transparent)",
        paid ? `box-shadow:inset 0 0 0 1px color-mix(in srgb,${accent} 32%,transparent)` : "box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 7%,transparent)",
        paid ? `color:${accent}` : "color:var(--color-token-text-tertiary,var(--color-token-text-secondary,currentColor))",
        "font-size:11px",
        "font-weight:500",
        "letter-spacing:0",
        "line-height:1.35",
        "text-align:right",
        "white-space:nowrap"
      ].join(";");
      return text;
    }
    function formatAccountPlanLabel(plan) {
      return plan.trim().toLowerCase().split(/[\s_-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
    }
    function accountDetailsLine(accountState, name, usage) {
      const fragments = usage.map(accountUsageFragment);
      if (!fragments.length) return null;
      const line = document.createElement("span");
      line.setAttribute("data-codexpp-account-usage", "");
      line.setAttribute("data-codexpp-account-details", "");
      const title = accountUsageTitle(accountState, name);
      if (title) line.title = title;
      line.style.cssText = [
        "display:grid",
        "grid-template-columns:minmax(0,1fr) auto",
        "align-items:baseline",
        "column-gap:10px",
        "width:100%",
        "min-width:0",
        "color:var(--color-token-text-secondary,currentColor)",
        "font-size:12px",
        "line-height:1.3",
        "font-variant-numeric:tabular-nums"
      ].join(";");
      line.appendChild(accountDetailsPart(fragments[0], "left"));
      if (fragments.length > 1) {
        line.appendChild(accountDetailsPart(fragments[1], "right"));
      }
      return line;
    }
    function accountPlanLabel(plan) {
      if (typeof plan !== "string" || !plan.trim()) return "";
      return formatAccountPlanLabel(plan);
    }
    function isPaidAccountPlan(plan) {
      return typeof plan === "string" && !/^free$/i.test(plan.trim());
    }
    function accountUsageFragment(part) {
      const value = `${part.pct}%`;
      if (part.projected) {
        return { label: part.label, value, meta: "reset" };
      }
      if (part.exhausted && part.resetAt) {
        return { label: part.label, value, meta: `resets ${part.resetAt}` };
      }
      if (part.label === "Weekly" && part.resetAt) {
        return { label: part.label, value, meta: formatWeeklyResetDate(part) };
      }
      return { label: part.label, value, meta: "" };
    }
    function formatWeeklyResetDate(part) {
      const resetAtMs = Number(part.resetAtMs);
      if (Number.isFinite(resetAtMs) && resetAtMs > 0) {
        const date = new Date(resetAtMs);
        if (Number.isFinite(date.getTime())) {
          return date.toLocaleDateString(void 0, { month: "short", day: "numeric" });
        }
      }
      return stripWeeklyResetTime(part.resetAt);
    }
    function stripWeeklyResetTime(resetAt) {
      if (typeof resetAt !== "string") return "";
      const dateMatch = /\b([A-Z][a-z]{2,8})\s+(\d{1,2})\b/.exec(resetAt);
      if (dateMatch) return `${dateMatch[1]} ${dateMatch[2]}`;
      return resetAt.replace(/^[A-Z][a-z]{2},\s*/i, "").replace(/\s+\d{1,2}:\d{2}\s*(?:AM|PM)?$/i, "").trim();
    }
    function accountDetailsPart(fragment, side) {
      const part = document.createElement("span");
      part.setAttribute(
        "aria-label",
        [fragment.label, fragment.value, fragment.meta].filter(Boolean).join(" ")
      );
      part.style.cssText = [
        "display:inline-flex",
        "align-items:baseline",
        "gap:4px",
        "min-width:0",
        "overflow:hidden",
        "text-overflow:ellipsis",
        "white-space:nowrap",
        "font-variant-numeric:tabular-nums",
        side === "right" ? "text-align:right" : "text-align:left",
        side === "right" ? "justify-content:flex-end" : "justify-content:flex-start",
        side === "right" ? "color:var(--color-token-text-tertiary,var(--color-token-text-secondary,currentColor))" : ""
      ].filter(Boolean).join(";");
      part.appendChild(accountUsageText(fragment.label, [
        "color:var(--color-token-text-tertiary,var(--color-token-text-secondary,currentColor))",
        "font-size:11px",
        "font-weight:400",
        "line-height:1.3"
      ]));
      part.appendChild(accountUsageText(fragment.value, [
        "color:var(--color-token-text-primary,currentColor)",
        "font-size:12px",
        "font-weight:500",
        "line-height:1.3"
      ]));
      if (fragment.meta) {
        part.appendChild(accountUsageText(fragment.meta, [
          "min-width:0",
          "overflow:hidden",
          "text-overflow:ellipsis",
          "color:var(--color-token-text-tertiary,var(--color-token-text-secondary,currentColor))",
          "font-size:11px",
          "font-weight:400",
          "line-height:1.3"
        ]));
      }
      return part;
    }
    function accountUsageText(text, styles) {
      const element = document.createElement("span");
      element.textContent = text;
      element.style.cssText = styles.join(";");
      return element;
    }
    module2.exports = { accountRow };
  }
});

// src/action-messages.js
var require_action_messages = __commonJS({
  "src/action-messages.js"(exports2, module2) {
    var { t: t2 } = require_i18n();
    var { accountDisplayName } = require_ui_components();
    function authReloadMessage(action, accountState) {
      if (action === "clear-active") {
        return t2("accounts.sessionClearedRelaunching");
      }
      const email = accountState.current ? accountDisplayName(accountState, accountState.current, { includeCurrent: false }) : t2("accounts.selected");
      return t2("accounts.switchedRelaunching", { email });
    }
    module2.exports = { authReloadMessage };
  }
});

// src/ui-settings.js
var require_ui_settings = __commonJS({
  "src/ui-settings.js"(exports2, module2) {
    var { errorMessage } = require_utils();
    var { invoke } = require_ipc();
    var { t: t2 } = require_i18n();
    var { refreshUsageInBackground } = require_usage_refresh();
    var { authReloadMessage } = require_action_messages();
    var {
      settingsButton,
      settingsSection,
      settingsCard,
      settingsRowShell,
      settingsInfoRow,
      settingsActionRow,
      settingsStatus,
      accountDisplayName,
      accountUsageSummary,
      bindButtonAction
    } = require_ui_components();
    async function renderAccountsPage(state, root) {
      root.textContent = "";
      root.appendChild(settingsStatus(t2("accounts.loading")));
      try {
        const accountState = await invoke(state, "state");
        renderAccountsPageState(state, root, accountState);
        refreshUsageInBackground(state, (freshState) => {
          if (root.isConnected) renderAccountsPageState(state, root, freshState);
        });
      } catch (error) {
        root.textContent = "";
        root.appendChild(settingsStatus(errorMessage(error), true));
      }
    }
    function renderAccountsPageState(state, root, accountState) {
      root.textContent = "";
      const intro = settingsSection(t2("settings.activeSession"));
      const introCard = settingsCard();
      const currentName = accountState.current || (accountState.hasActiveAuth ? t2("settings.unsavedAccount") : t2("settings.noActiveSession"));
      const currentValue = accountState.current ? accountDisplayName(accountState, accountState.current, { includeCurrent: false }) : currentName;
      introCard.appendChild(
        settingsInfoRow(
          t2("settings.signedInAs"),
          currentValue,
          accountState.hasActiveAuth ? t2("settings.activeAuthDescription") : t2("settings.noAuthDescription")
        )
      );
      intro.appendChild(introCard);
      root.appendChild(intro);
      const actions = settingsSection(t2("settings.accountSetup"));
      const actionCard = settingsCard();
      actionCard.appendChild(
        settingsActionRow(
          t2("settings.signInAnother"),
          t2("settings.signInAnotherDescription"),
          t2("settings.startSignIn"),
          () => clearActiveFromSettings(state, root)
        )
      );
      actionCard.appendChild(
        settingsActionRow(
          t2("settings.refreshSaved"),
          t2("settings.refreshSavedDescription"),
          t2("settings.refresh"),
          () => renderAccountsPage(state, root)
        )
      );
      actions.appendChild(actionCard);
      root.appendChild(actions);
      const saved = settingsSection(t2("settings.savedAccounts"));
      const savedCard = settingsCard();
      const accounts = Array.isArray(accountState.accounts) ? accountState.accounts : [];
      if (!accounts.length) {
        savedCard.appendChild(
          settingsInfoRow(
            t2("settings.noSavedAccounts"),
            t2("settings.noneFound"),
            t2("settings.noSavedAccountsDescription")
          )
        );
      } else {
        for (const name of accounts) {
          savedCard.appendChild(settingsAccountRow(state, root, accountState, name));
        }
      }
      saved.appendChild(savedCard);
      root.appendChild(saved);
      if (accountState.notice || accountState.error) {
        root.appendChild(settingsStatus(accountState.notice || accountState.error, !!accountState.error));
      }
    }
    function settingsAccountRow(state, root, accountState, name) {
      const row = settingsRowShell();
      const left = document.createElement("div");
      left.className = "flex min-w-0 flex-col gap-1";
      const title = document.createElement("div");
      title.className = "min-w-0 truncate text-sm text-token-text-primary";
      title.textContent = accountDisplayName(accountState, name);
      title.title = accountDisplayName(accountState, name, { includeCurrent: false });
      left.appendChild(title);
      const desc = document.createElement("div");
      desc.className = "text-token-text-secondary min-w-0 text-sm";
      desc.textContent = accountUsageSummary(accountState, name) || (accountState.current === name ? t2("settings.activeInWindow") : t2("settings.usageUnchecked"));
      left.appendChild(desc);
      row.appendChild(left);
      const actionsEl = document.createElement("div");
      actionsEl.className = "flex shrink-0 items-center gap-2";
      const switchButton = settingsButton(t2("settings.switch"));
      switchButton.disabled = accountState.current === name;
      bindButtonAction(
        switchButton,
        () => runSettingsAction(state, root, "switch", { name }, t2("accounts.switching"))
      );
      actionsEl.appendChild(switchButton);
      const removeButton = settingsButton(t2("settings.delete"));
      bindButtonAction(removeButton, () => {
        runSettingsAction(state, root, "delete", { name }, t2("settings.removing"));
      });
      actionsEl.appendChild(removeButton);
      row.appendChild(actionsEl);
      return row;
    }
    function clearActiveFromSettings(state, root) {
      runSettingsAction(state, root, "clear-active", {}, t2("accounts.preparingSignIn"));
    }
    async function runSettingsAction(state, root, action, payload, loadingText) {
      root.textContent = "";
      root.appendChild(settingsStatus(loadingText));
      try {
        const accountState = await invoke(state, action, payload);
        if (action === "switch" || action === "clear-active") {
          root.textContent = "";
          root.appendChild(settingsStatus(authReloadMessage(action, accountState)));
          scheduleAppRelaunch(state, root);
          return;
        }
        renderAccountsPageState(state, root, accountState);
      } catch (error) {
        renderAccountsPageState(state, root, {
          ...state.lastState || { accounts: [], current: null, hasActiveAuth: false },
          error: errorMessage(error)
        });
      }
    }
    function scheduleAppRelaunch(state, root) {
      window.setTimeout(() => {
        invoke(state, "relaunch").catch((error) => {
          root.textContent = "";
          root.appendChild(settingsStatus(t2("accounts.relaunchFailed", { error: errorMessage(error) }), true));
        });
      }, 1200);
    }
    module2.exports = {
      renderAccountsPage,
      renderAccountsPageState
    };
  }
});

// src/ui-collapsible.js
var require_ui_collapsible = __commonJS({
  "src/ui-collapsible.js"(exports2, module2) {
    var { prefersReducedMotion } = require_ui_components();
    var ACCOUNTS_PANEL_TRANSITION_MS = 300;
    var ACCOUNTS_PANEL_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
    var ACCOUNTS_CHEVRON_COLLAPSED = "rotate(0deg)";
    var ACCOUNTS_CHEVRON_EXPANDED = "rotate(90deg)";
    var ACCOUNTS_BODY_COLLAPSED_TRANSFORM = "translateY(-2px)";
    var ACCOUNTS_BODY_EXPANDED_TRANSFORM = "translateY(0)";
    function accountsPanelDuration() {
      if (prefersReducedMotion()) return 0;
      return ACCOUNTS_PANEL_TRANSITION_MS;
    }
    function accountsBodyTransition(duration) {
      return `max-height ${duration}ms ${ACCOUNTS_PANEL_EASING},opacity ${duration}ms ${ACCOUNTS_PANEL_EASING},transform ${duration}ms ${ACCOUNTS_PANEL_EASING}`;
    }
    function accountsChevronTransform(expanded) {
      return expanded ? ACCOUNTS_CHEVRON_EXPANDED : ACCOUNTS_CHEVRON_COLLAPSED;
    }
    function accountsBodyCss(expanded) {
      return [
        "overflow:hidden",
        "max-height:0",
        "opacity:0",
        `transform:${expanded ? ACCOUNTS_BODY_EXPANDED_TRANSFORM : ACCOUNTS_BODY_COLLAPSED_TRANSFORM}`,
        `pointer-events:${expanded ? "auto" : "none"}`,
        `transition:${expanded ? "none" : accountsBodyTransition(ACCOUNTS_PANEL_TRANSITION_MS)}`
      ].join(";");
    }
    function createAccountsCollapsible(state, elements, expanded) {
      applyAccountsExpanded(state, elements, expanded, { animate: false });
      if (expanded && typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => {
          if (elements.body.isConnected) {
            elements.body.style.transition = accountsBodyTransition(accountsPanelDuration());
          }
        });
      }
      return {
        toggle() {
          applyAccountsExpanded(state, elements, !state.accountsExpanded, { animate: true });
        },
        collapse() {
          applyAccountsExpanded(state, elements, false, { animate: true });
        }
      };
    }
    function applyAccountsExpanded(state, elements, expanded, options) {
      state.accountsExpanded = expanded;
      const duration = options.animate ? accountsPanelDuration() : 0;
      if (options.animate) {
        elements.body.style.transition = accountsBodyTransition(duration);
      }
      elements.body.style.pointerEvents = expanded ? "auto" : "none";
      elements.body.style.maxHeight = expanded ? elements.body.scrollHeight + "px" : "0";
      elements.body.style.opacity = expanded ? "1" : "0";
      elements.body.style.transform = expanded ? ACCOUNTS_BODY_EXPANDED_TRANSFORM : ACCOUNTS_BODY_COLLAPSED_TRANSFORM;
      elements.header.setAttribute("aria-expanded", String(expanded));
      if (elements.chevron) {
        elements.chevron.style.transitionDuration = duration + "ms";
        elements.chevron.style.transform = accountsChevronTransform(expanded);
      }
      for (const note of elements.notes) {
        note.style.display = expanded ? "block" : "none";
      }
    }
    module2.exports = {
      ACCOUNTS_PANEL_EASING,
      ACCOUNTS_PANEL_TRANSITION_MS,
      accountsBodyCss,
      accountsBodyTransition,
      accountsChevronTransform,
      accountsPanelDuration,
      createAccountsCollapsible
    };
  }
});

// src/ui-popup.js
var require_ui_popup = __commonJS({
  "src/ui-popup.js"(exports2, module2) {
    var { errorMessage } = require_utils();
    var { invoke } = require_ipc();
    var { t: t2 } = require_i18n();
    var { protectInteractiveControl } = require_dom_utils();
    var { refreshUsageInBackground } = require_usage_refresh();
    var { accountRow } = require_ui_account_row();
    var { authReloadMessage } = require_action_messages();
    var { renderAccountsPageState } = require_ui_settings();
    var {
      accountPanelShell,
      setPanelStatus,
      addButtonFeedback,
      bindButtonAction,
      prefersReducedMotion
    } = require_ui_components();
    var {
      ACCOUNTS_PANEL_EASING,
      accountsBodyCss,
      accountsChevronTransform,
      accountsPanelDuration,
      createAccountsCollapsible
    } = require_ui_collapsible();
    var ACCOUNTS_CHEVRON_SIZE = "16";
    var ACCOUNTS_CHEVRON_COLOR = "#5C5B56";
    var ACCOUNTS_COLLAPSIBLE_KEY = "__codexppAccountsCollapsible";
    function renderAccountPanel(state, panel, accountState) {
      panel.textContent = "";
      panel.setAttribute("data-codexpp-account-switcher", "panel");
      const accounts = Array.isArray(accountState.accounts) ? accountState.accounts : [];
      const expanded = state.accountsExpanded === true;
      const section = document.createElement("div");
      section.style.cssText = "display:flex;flex-direction:column;padding:0;";
      const header = accountsHeaderRow(state, panel, accountState, expanded);
      section.appendChild(header);
      const list = document.createElement("div");
      list.style.cssText = "display:flex;flex-direction:column;min-width:0;gap:1px;padding:2px 0 4px;";
      if (accounts.length === 0) {
        const empty = document.createElement("div");
        empty.textContent = accountState.hasActiveAuth ? t2("accounts.emptySaved") : t2("accounts.emptyActive");
        empty.style.cssText = "font-size:12px;color:var(--color-token-text-secondary,currentColor);padding:2px var(--codexpp-menu-row-padding-right,24px) 4px var(--codexpp-menu-text-inset,64px);";
        list.appendChild(empty);
      }
      for (const name of accounts) {
        list.appendChild(accountRow(accountState, name, (accountName) => {
          void runPanelAction(state, panel, "switch", { name: accountName }, t2("accounts.switching"));
        }));
      }
      list.appendChild(configureAccountsRow(state, panel));
      const body = document.createElement("div");
      body.setAttribute("data-codexpp-account-switcher-body", "accounts");
      body.style.cssText = accountsBodyCss(expanded);
      const bodyInner = document.createElement("div");
      bodyInner.style.cssText = "min-height:0;";
      bodyInner.appendChild(list);
      body.appendChild(bodyInner);
      section.appendChild(body);
      panel.appendChild(section);
      const notes = [];
      if (accountState.notice || accountState.error) {
        const note = document.createElement("div");
        note.setAttribute("data-codexpp-account-switcher-notice", "");
        note.textContent = accountState.notice || accountState.error;
        note.style.cssText = "padding:0 var(--codexpp-menu-row-padding-right,24px) 6px var(--codexpp-menu-text-inset,64px);font-size:11px;line-height:1.3;color:" + (accountState.error ? "var(--color-token-text-error,#ff6b6b)" : "var(--color-token-text-secondary,currentColor)") + ";";
        if (expanded) note.style.display = "block";
        else note.style.display = "none";
        notes.push(note);
        panel.appendChild(note);
      }
      panel[ACCOUNTS_COLLAPSIBLE_KEY] = createAccountsCollapsible(
        state,
        {
          body,
          header,
          chevron: header.querySelector("[data-accounts-chevron] svg"),
          notes
        },
        expanded
      );
    }
    function accountsHeaderRow(state, panel, accountState, expanded) {
      const metrics = nativeCollapsibleMetrics(panel);
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-expanded", expanded ? "true" : "false");
      button.style.cssText = [
        "width:100%",
        "border:0",
        "background:transparent",
        "color:var(--color-token-text-primary,currentColor)",
        "font:inherit",
        "font-size:13px",
        "line-height:1.25",
        "text-align:left",
        "border-radius:var(--codexpp-menu-row-radius,8px)",
        "min-height:var(--codexpp-menu-row-height,40px)",
        "padding:var(--codexpp-menu-row-padding-top,0) var(--codexpp-menu-row-padding-right,24px) var(--codexpp-menu-row-padding-bottom,0) var(--codexpp-menu-text-inset,64px)",
        "position:relative",
        "cursor:default",
        "display:flex",
        "align-items:center",
        "gap:0"
      ].join(";");
      button.appendChild(accountsIconSlot());
      const title = document.createElement("span");
      title.textContent = t2("accounts.title");
      title.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit;";
      button.appendChild(title);
      const chevronSlot = document.createElement("span");
      chevronSlot.setAttribute("data-accounts-chevron", "");
      chevronSlot.style.cssText = `display:flex;align-items:center;justify-content:center;width:${metrics.chevronSlotWidth};height:20px;margin-left:auto;margin-right:${metrics.chevronMarginRight};flex:0 0 ${metrics.chevronSlotWidth};color:${metrics.chevronColor};opacity:${metrics.chevronOpacity};`;
      chevronSlot.appendChild(cloneUsageRemainingChevron(panel, expanded, metrics));
      button.appendChild(chevronSlot);
      addButtonFeedback(button, {
        normal: { background: "transparent" },
        hover: { background: "color-mix(in srgb,currentColor 8%,transparent)" },
        active: {
          background: "color-mix(in srgb,currentColor 12%,transparent)",
          transform: prefersReducedMotion() ? "" : "scale(0.96)"
        }
      });
      protectInteractiveControl(button);
      bindButtonAction(button, () => toggleAccountsExpanded(panel));
      return button;
    }
    function toggleAccountsExpanded(panel) {
      panel[ACCOUNTS_COLLAPSIBLE_KEY]?.toggle();
    }
    function accountsIconSlot() {
      const slot = document.createElement("span");
      slot.setAttribute("aria-hidden", "true");
      slot.style.cssText = "position:absolute;left:var(--codexpp-menu-icon-left,24px);top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;height:24px;width:var(--codexpp-menu-icon-slot-width,24px);color:var(--color-token-text-secondary,var(--color-token-text-tertiary,currentColor));";
      slot.appendChild(accountsIcon());
      return slot;
    }
    function accountsIcon() {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("data-codexpp-accounts-icon", "");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "18");
      svg.setAttribute("height", "18");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.style.display = "block";
      svg.style.color = "inherit";
      for (const [tagName, attrs] of [
        ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
        ["circle", { cx: "9", cy: "7", r: "4" }],
        ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }],
        ["path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }]
      ]) {
        const child = document.createElementNS("http://www.w3.org/2000/svg", tagName);
        for (const [name, value] of Object.entries(attrs)) {
          child.setAttribute(name, value);
        }
        svg.appendChild(child);
      }
      return svg;
    }
    function cloneUsageRemainingChevron(panel, expanded, metrics) {
      const reference = findNativeCollapsibleReference(panel);
      const size = metrics?.chevronSize || ACCOUNTS_CHEVRON_SIZE;
      if (reference?.chevron) {
        const clone = reference.chevron.cloneNode(true);
        return prepareChevronSvg(clone, expanded, size);
      }
      return prepareChevronSvg(accountsChevronIcon(), expanded, size);
    }
    function prepareChevronSvg(svg, expanded, size) {
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      svg.setAttribute("width", size || ACCOUNTS_CHEVRON_SIZE);
      svg.setAttribute("height", size || ACCOUNTS_CHEVRON_SIZE);
      normalizeChevronPaint(svg);
      svg.style.color = "inherit";
      svg.style.display = "block";
      svg.style.flex = "0 0 auto";
      svg.style.visibility = "visible";
      svg.style.transform = accountsChevronTransform(expanded);
      svg.style.transformOrigin = "center";
      svg.style.transition = `transform ${accountsPanelDuration(true)}ms ${ACCOUNTS_PANEL_EASING}`;
      return svg;
    }
    function normalizeChevronPaint(svg) {
      const painted = [svg, ...svg.querySelectorAll("[stroke], [fill]")];
      for (const element of painted) {
        const stroke = element.getAttribute("stroke");
        if (stroke && stroke !== "none") element.setAttribute("stroke", "currentColor");
        const fill = element.getAttribute("fill");
        if (fill && fill !== "none") element.setAttribute("fill", "currentColor");
        element.style.color = "inherit";
        element.style.opacity = "1";
      }
    }
    function accountsChevronIcon() {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("data-codexpp-accounts-chevron-fallback", "");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "m9 18 6-6-6-6");
      svg.appendChild(path);
      return svg;
    }
    function nativeCollapsibleMetrics(panel) {
      const fallback = {
        chevronColor: ACCOUNTS_CHEVRON_COLOR,
        chevronOpacity: "1",
        chevronMarginRight: "0px",
        chevronSlotWidth: "20px"
      };
      const reference = findNativeCollapsibleReference(panel);
      if (!reference?.row || typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
        return fallback;
      }
      const rowStyle = window.getComputedStyle(reference.row);
      const chevronStyle = reference.chevron ? window.getComputedStyle(reference.chevron) : null;
      const chevronRect = reference.chevron && typeof reference.chevron.getBoundingClientRect === "function" ? reference.chevron.getBoundingClientRect() : null;
      const rowRect = typeof reference.row.getBoundingClientRect === "function" ? reference.row.getBoundingClientRect() : null;
      const paddingRight = parseCssPixels(rowStyle.paddingRight);
      const chevronWidth = chevronRect?.width > 0 ? chevronRect.width : Number.parseFloat(ACCOUNTS_CHEVRON_SIZE);
      const slotWidth = Math.max(20, Math.round(chevronWidth));
      const rightInset = rowRect && chevronRect?.width > 0 ? rowRect.right - chevronRect.right : paddingRight;
      const opticalInset = (slotWidth - chevronWidth) / 2;
      const marginRight = Number.isFinite(rightInset) && Number.isFinite(paddingRight) ? Math.round(rightInset - paddingRight - opticalInset) : 0;
      const color = ACCOUNTS_CHEVRON_COLOR;
      const opacity = fallback.chevronOpacity;
      const chevronSize = String(Math.round(chevronWidth));
      return {
        chevronColor: color,
        chevronOpacity: opacity,
        chevronMarginRight: `${marginRight}px`,
        chevronSlotWidth: `${slotWidth}px`,
        chevronSize
      };
    }
    function findNativeCollapsibleReference(panel) {
      return findNativeCollapsibleRow(panel, /\busage remaining\b/i) || findNativeCollapsibleRow(panel, /\brate limits/i);
    }
    function findNativeCollapsibleRow(panel, pattern) {
      const menu = panel.closest('[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]') || document;
      const row = Array.from(menu.querySelectorAll('button, a, [role="menuitem"]')).find((element) => {
        return element instanceof HTMLElement && pattern.test(element.textContent || "");
      });
      if (!(row instanceof HTMLElement)) return null;
      const icons = Array.from(row.querySelectorAll("svg"));
      const chevron = icons.length ? icons[icons.length - 1] : null;
      return { row, chevron };
    }
    function parseCssPixels(value) {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    function configureAccountsRow(state, panel) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = t2("accounts.configure");
      button.style.cssText = "box-sizing:border-box;width:100%;border:0;background:transparent;color:var(--color-token-text-secondary,currentColor);font:inherit;font-size:13px;line-height:1.25;text-align:left;border-radius:6px;margin:0;min-height:32px;padding:0 var(--codexpp-menu-row-padding-right,24px) 0 var(--codexpp-menu-text-inset,64px);cursor:default;";
      addButtonFeedback(button, {
        normal: { background: "transparent" },
        hover: { background: "color-mix(in srgb,currentColor 7%,transparent)" },
        active: {
          background: "color-mix(in srgb,currentColor 10%,transparent)",
          transform: prefersReducedMotion() ? "" : "scale(0.96)"
        }
      });
      protectInteractiveControl(button);
      bindButtonAction(button, () => openAccountsSettings(state, panel));
      return button;
    }
    function openAccountsSettings(state, panel) {
      const menu = panel.closest('[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]') || document;
      const settingsItem = findMenuCommand(menu, /settings/i);
      panel[ACCOUNTS_COLLAPSIBLE_KEY]?.collapse();
      settingsItem?.click();
      window.setTimeout(() => {
        const accountsNav = Array.from(
          document.querySelectorAll('button[data-codexpp^="nav-page-"], button')
        ).find((element) => {
          return element instanceof HTMLElement && /\baccounts\b/i.test(element.textContent || "");
        });
        if (accountsNav instanceof HTMLElement) accountsNav.click();
      }, 300);
      window.setTimeout(() => {
        if (panel.isConnected) panel.remove();
      }, accountsPanelDuration(false));
    }
    function findMenuCommand(root, pattern) {
      return Array.from(root.querySelectorAll('button, a, [role="menuitem"]')).find((element) => {
        return element instanceof HTMLElement && pattern.test(element.textContent || "");
      });
    }
    async function runPanelAction(state, panel, action, payload, loadingText) {
      setPanelStatus(panel, loadingText);
      try {
        const accountState = await invoke(state, action, payload);
        if (action === "switch" || action === "clear-active") {
          setPanelStatus(panel, authReloadMessage(action, accountState));
          return;
        }
        renderAccountPanel(state, panel, accountState);
        if (state.settingsRoot?.isConnected) {
          renderAccountsPageState(state, state.settingsRoot, accountState);
        }
      } catch (error) {
        renderAccountPanel(state, panel, {
          ...state.lastState || { accounts: [], current: null, hasActiveAuth: false },
          error: errorMessage(error)
        });
      }
    }
    async function refreshPanel(state, panel) {
      setPanelStatus(panel, t2("accounts.loading"));
      try {
        const accountState = await invoke(state, "state");
        renderAccountPanel(state, panel, accountState);
        refreshUsageInBackground(state, (freshState) => {
          if (panel.isConnected) renderAccountPanel(state, panel, freshState);
          if (state.settingsRoot?.isConnected) {
            renderAccountsPageState(state, state.settingsRoot, freshState);
          }
        });
      } catch (error) {
        setPanelStatus(panel, errorMessage(error));
      }
    }
    module2.exports = { renderAccountPanel, accountPanelShell, refreshPanel };
  }
});

// src/renderer.js
var require_renderer = __commonJS({
  "src/renderer.js"(exports2, module2) {
    var { compactText, findMenuItem } = require_dom_utils();
    var {
      RATE_LIMITS_PATTERN,
      USAGE_REMAINING_PATTERN,
      findSettingsAccountMenu,
      hasAccountMenuMarker,
      isAccountMenuText
    } = require_menu_finder();
    var { accountPanelShell, renderAccountPanel, refreshPanel } = require_ui_popup();
    var { renderAccountsPage } = require_ui_settings();
    function startRenderer2(state) {
      if (typeof state.api.settings?.registerPage === "function") {
        const pageHandle = state.api.settings.registerPage({
          id: "accounts",
          title: "Accounts",
          description: "Switch Codex accounts and manage saved sessions.",
          iconSvg: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-sm inline-block align-middle" aria-hidden="true"><path d="M10 10.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" stroke="currentColor" stroke-width="1.5"/><path d="M4.75 16.25c.7-2.15 2.65-3.5 5.25-3.5s4.55 1.35 5.25 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
          render: (root) => {
            state.settingsRoot = root;
            renderAccountsPage(state, root);
          }
        });
        state.disposers.push(() => pageHandle.unregister?.());
      } else {
        state.api.log.warn(
          "[account-switcher] registerPage unavailable; account controls will only appear in the account menu."
        );
      }
      const schedule = () => {
        if (state.disposed || state.pending) return;
        state.pending = window.requestAnimationFrame(() => {
          state.pending = 0;
          scanForAccountMenu(state);
        });
      };
      state.observer = new MutationObserver(schedule);
      state.observer.observe(document.documentElement, { childList: true, subtree: true });
      state.disposers.push(() => state.observer?.disconnect());
      document.addEventListener("pointerdown", schedule, true);
      document.addEventListener("keydown", schedule, true);
      state.disposers.push(() => document.removeEventListener("pointerdown", schedule, true));
      state.disposers.push(() => document.removeEventListener("keydown", schedule, true));
      state.pollTimer = window.setInterval(schedule, 300);
      state.disposers.push(() => window.clearInterval(state.pollTimer));
      schedule();
    }
    function scanForAccountMenu(state) {
      const menu = findSettingsAccountMenu();
      if (!menu) return;
      if (menu.querySelector("[data-codexpp-account-switcher]")) return;
      installAccountSwitcher(state, menu);
    }
    function installAccountSwitcher(state, menu) {
      const target = findMenuItem(menu, /settings/i) || findMenuItem(menu, USAGE_REMAINING_PATTERN) || findMenuItem(menu, RATE_LIMITS_PATTERN) || findMenuItem(menu, /personal account/i) || Array.from(menu.children).find((child) => child instanceof HTMLElement);
      if (!(target instanceof HTMLElement) || !target.parentElement) return;
      const panel = accountPanelShell(target);
      if (/\bpersonal account\b/i.test(compactText(target))) {
        const prev = target.previousElementSibling;
        if (prev instanceof HTMLElement) prev.remove();
      }
      target.before(panel);
      refreshPanel(state, panel).catch((error) => {
        state.api.log.warn("[account-switcher] panel load failed", String(error));
      });
    }
    module2.exports = {
      startRenderer: startRenderer2,
      _test: {
        hasAccountMenuMarker,
        isAccountMenuText
      }
    };
  }
});

// index.js
var { GLOBAL_SERVICE_KEY, IPC_HANDLER_KEY, IPC_CHANNEL } = require_constants();
var { createAccountService } = require_service();
var { startRenderer } = require_renderer();
module.exports = {
  start(api2) {
    if (api2.process === "main") {
      startMain(api2);
      return;
    }
    const state = {
      api: api2,
      accountsExpanded: false,
      observer: null,
      pending: 0,
      disposed: false,
      disposers: [],
      lastState: null,
      lastUsageRefreshAt: 0,
      settingsRoot: null,
      usageRefreshInFlight: false
    };
    this._state = state;
    startRenderer(state);
  },
  stop() {
    const state = this._state;
    if (!state) return;
    state.disposed = true;
    if (state.observer) state.observer.disconnect();
    if (state.pending) window.cancelAnimationFrame(state.pending);
    for (const dispose of state.disposers.splice(0).reverse()) {
      try {
        dispose();
      } catch {
      }
    }
    this._pageHandle?.unregister?.();
    document.querySelectorAll("[data-codexpp-account-switcher]").forEach((element) => {
      element.remove();
    });
  }
};
function startMain(api2) {
  const service = createAccountService(api2);
  globalThis[GLOBAL_SERVICE_KEY] = service;
  if (!globalThis[IPC_HANDLER_KEY]) {
    api2.ipc.handle(IPC_CHANNEL, async (message) => {
      const active = globalThis[GLOBAL_SERVICE_KEY];
      return active.handle(message);
    });
    globalThis[IPC_HANDLER_KEY] = true;
  }
  api2.log.info("[account-switcher] main provider active");
}
