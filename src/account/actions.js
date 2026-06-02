const { t } = require("../i18n");
const {
  nodeDeps,
  codexAuthPaths,
  normalizeAccountName,
  accountPath,
  ensureDir,
  pathExists,
} = require("../node-utils");
const { readState } = require("./state");
const {
  ensureAutosavedActiveAccount,
  getCurrentAccountName,
  listAccountNames,
} = require("./storage");
const { fetchActiveUsageSnapshot, writeAccountUsage } = require("./usage");
const {
  readAuthJson,
  saveAuthSnapshotWithCurrentBaseUrl,
  setTopLevelOpenAIBaseUrl,
  syncOpenAIBaseUrlForAccount,
} = require("./config");

let relaunchScheduled = false;
const MAC_APP_EXEC_MARKER = ".app/Contents/MacOS/";
const MAC_REOPEN_DELAY_SECONDS = "1";
const MAC_REOPEN_SCRIPT = 'sleep "$1"; exec /usr/bin/open -n "$2"';

async function saveCurrentAccount(rawName) {
  const { fsp } = nodeDeps();
  const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
  const name = normalizeAccountName(rawName);
  if (!(await pathExists(AUTH_PATH))) {
    throw new Error(`No active Codex auth file found at ${AUTH_PATH}`);
  }
  await ensureDir(ACCOUNTS_DIR);
  await saveAuthSnapshotWithCurrentBaseUrl(AUTH_PATH, accountPath(name));
  await fsp.writeFile(CURRENT_NAME_PATH, `${name}\n`, "utf8");
  return readState({ notice: t("service.saved", { name }) });
}

async function switchAccount(rawName, api) {
  const { fsp } = nodeDeps();
  const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
  const name = normalizeAccountName(rawName);
  const source = accountPath(name);
  if (!(await pathExists(source))) throw new Error(`Saved account not found: ${name}`);
  await ensureDir(CODEX_DIR);
  await ensureAutosavedActiveAccount();
  try {
    const account = await readAuthJson(source, `Saved account ${name}`);
    await syncOpenAIBaseUrlForAccount(account);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api?.log?.warn?.(`[account-switcher] skipped base URL sync for ${name}: ${message}`);
  }
  await fsp.copyFile(source, AUTH_PATH);
  await fsp.writeFile(CURRENT_NAME_PATH, `${name}\n`, "utf8");
  api?.log?.info?.(`[account-switcher] switched auth file to ${name}; scheduling app relaunch`);
  scheduleCodexRelaunch(api, 0);
  return readState({
    notice: t("service.switched", { name }),
    requiresAppRelaunch: true,
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

async function clearActiveAuth(api) {
  const { fsp, path } = nodeDeps();
  const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
  await ensureDir(CODEX_DIR);
  await setTopLevelOpenAIBaseUrl(null);
  if (await pathExists(AUTH_PATH)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fsp.copyFile(AUTH_PATH, path.join(CODEX_DIR, `auth.account-switcher-backup-${stamp}.json`));
    await fsp.rm(AUTH_PATH, { force: true });
  }
  await fsp.rm(CURRENT_NAME_PATH, { force: true });
  api?.log?.info?.("[account-switcher] cleared active auth file; scheduling app relaunch");
  scheduleCodexRelaunch(api, 0);
  return readState({
    notice: t("service.sessionCleared"),
    requiresAppRelaunch: true,
  });
}

async function refreshActiveUsage(api) {
  const accounts = await listAccountNames();
  const current = await getCurrentAccountName(accounts);
  if (!current) return readState();
  const snapshot = await fetchActiveUsageSnapshot(api);
  await writeAccountUsage(current, snapshot);
  return readState();
}

async function relaunchCodex(api) {
  api?.log?.info?.("[account-switcher] relaunch requested");
  scheduleCodexRelaunch(api, 100);
  return readState({ notice: t("service.relaunching") });
}

function scheduleCodexRelaunch(api, delayMs) {
  if (relaunchScheduled) return;
  const app = electronApp(api);
  const schedule = typeof api?.setTimeout === "function" ? api.setTimeout.bind(api) : setTimeout;
  relaunchScheduled = true;
  schedule(() => {
    relaunchScheduled = false;
    relaunchCodexNow(api, app);
  }, delayMs);
}

function relaunchCodexNow(api, app) {
  if (!scheduleMacCodexReopen(api)) {
    app.relaunch();
  }
  app.exit(0);
}

function scheduleMacCodexReopen(api) {
  const platform = api?.platform || process.platform;
  if (platform !== "darwin") return false;

  const appRoot = inferMacAppRoot(api?.execPath || process.execPath);
  if (!appRoot) {
    api?.log?.warn?.("[account-switcher] unable to infer macOS app root; using Electron relaunch");
    return false;
  }

  try {
    const spawn = api?.spawn || require("node:child_process").spawn;
    const child = spawn(
      "/bin/sh",
      ["-c", MAC_REOPEN_SCRIPT, "codex-account-switcher-relaunch", MAC_REOPEN_DELAY_SECONDS, appRoot],
      { detached: true, stdio: "ignore" },
    );
    child.unref();
    api?.log?.info?.(`[account-switcher] scheduled detached macOS reopen for ${appRoot}`);
    return true;
  } catch (error) {
    api?.log?.warn?.(`[account-switcher] unable to schedule detached macOS reopen: ${String(error)}`);
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
  relaunchCodex,
};
