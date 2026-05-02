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
        if (action === "state") return ok(await readState());
        if (action === "save") return ok(await saveCurrentAccount(message?.name));
        if (action === "switch") return ok(await switchAccount(message?.name));
        if (action === "delete") return ok(await deleteAccount(message?.name));
        if (action === "clear-active") return ok(await clearActiveAuth());
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
  return {
    accounts,
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

async function switchAccount(rawName) {
  const { fsp } = nodeDeps();
  const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
  const name = normalizeAccountName(rawName);
  const source = accountPath(name);
  if (!(await pathExists(source))) throw new Error(`Saved account not found: ${name}`);
  await ensureDir(CODEX_DIR);
  await fsp.copyFile(source, AUTH_PATH);
  await fsp.writeFile(CURRENT_NAME_PATH, `${name}\n`, "utf8");
  return readState({
    notice: `Switched to ${name}. Restart Codex if this window still shows the old account.`,
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

async function clearActiveAuth() {
  const { fsp, path } = nodeDeps();
  const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
  await ensureDir(CODEX_DIR);
  if (await pathExists(AUTH_PATH)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fsp.copyFile(AUTH_PATH, path.join(CODEX_DIR, `auth.account-switcher-backup-${stamp}.json`));
    await fsp.rm(AUTH_PATH, { force: true });
  }
  await fsp.rm(CURRENT_NAME_PATH, { force: true });
  return readState({
    notice: "Cleared active auth. Restart Codex and log in, then use Save current account.",
  });
}

module.exports = { createAccountService };
