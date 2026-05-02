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
    function ok2(state) {
      return { ok: true, state };
    }
    function fail2(error) {
      return { ok: false, error };
    }
    function errorMessage2(error) {
      return error instanceof Error ? error.message : String(error);
    }
    function stringifyError2(error) {
      return error instanceof Error ? error.stack || error.message : String(error);
    }
    module2.exports = { ok: ok2, fail: fail2, errorMessage: errorMessage2, stringifyError: stringifyError2 };
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
        ACCOUNTS_DIR: path.join(CODEX_DIR, "auth_accounts"),
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

// src/account-service.js
var require_account_service = __commonJS({
  "src/account-service.js"(exports, module) {
    var { ok, fail, errorMessage, stringifyError } = require_utils();
    var {
      nodeDeps,
      codexAuthPaths,
      normalizeAccountName,
      accountPath,
      ensureDir,
      pathExists
    } = require_node_utils();
    function createAccountService(api2) {
      return {
        async handle(message) {
          const action = message?.action;
          try {
            api2.log?.info?.(`[account-switcher] action ${String(action)}`);
            if (action === "state") return ok(await readState());
            if (action === "save") return ok(await saveCurrentAccount(message?.name));
            if (action === "switch") return ok(await switchAccount(message?.name, api2));
            if (action === "delete") return ok(await deleteAccount(message?.name));
            if (action === "clear-active") return ok(await clearActiveAuth(api2));
            if (action === "relaunch") return ok(await relaunchCodex(api2));
            return fail(`Unknown account action: ${String(action)}`);
          } catch (error) {
            api2.log.warn("[account-switcher] action failed", stringifyError(error));
            return fail(errorMessage(error));
          }
        }
      };
    }
    async function readState(extra = {}) {
      const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
      await ensureAutosavedActiveAccount();
      const accounts = await listAccountNames();
      const current = await getCurrentAccountName(accounts);
      const hasActiveAuth = await pathExists(AUTH_PATH);
      const accountEmails = await readAccountEmails(accounts);
      return {
        accounts,
        accountEmails,
        current,
        hasActiveAuth,
        paths: {
          auth: AUTH_PATH,
          accountsDir: ACCOUNTS_DIR,
          current: CURRENT_NAME_PATH
        },
        ...extra
      };
    }
    async function readAccountEmails(accounts) {
      const entries = await Promise.all(
        accounts.map(async (name) => [name, await readAccountEmail(accountPath(name))])
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
      if (!await pathExists(ACCOUNTS_DIR)) return [];
      const entries = await fsp.readdir(ACCOUNTS_DIR, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name.replace(/\.json$/i, "")).sort((a, b) => a.localeCompare(b, void 0, { sensitivity: "base" }));
    }
    async function getCurrentAccountName(accounts) {
      const { fsp, path } = nodeDeps();
      const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
      if (!await pathExists(AUTH_PATH)) return null;
      const matched = await findMatchingAccountByContents(accounts);
      if (matched) return matched;
      try {
        const raw = await fsp.readFile(CURRENT_NAME_PATH, "utf8");
        const name = raw.trim();
        if (name && accounts.includes(name)) return name;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      if (!await pathExists(AUTH_PATH)) return null;
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
        }
      }
      return null;
    }
    async function saveCurrentAccount(rawName) {
      const { fsp } = nodeDeps();
      const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
      const name = normalizeAccountName(rawName);
      if (!await pathExists(AUTH_PATH)) {
        throw new Error(`No active Codex auth file found at ${AUTH_PATH}`);
      }
      await ensureDir(ACCOUNTS_DIR);
      await fsp.copyFile(AUTH_PATH, accountPath(name));
      await fsp.writeFile(CURRENT_NAME_PATH, `${name}
`, "utf8");
      return readState({ notice: `Saved current account as ${name}.` });
    }
    async function ensureAutosavedActiveAccount() {
      const { fsp } = nodeDeps();
      const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
      if (!await pathExists(AUTH_PATH)) return null;
      const accounts = await listAccountNames();
      const matched = await findMatchingAccountByContents(accounts);
      if (matched) {
        await fsp.writeFile(CURRENT_NAME_PATH, `${matched}
`, "utf8");
        return matched;
      }
      await ensureDir(ACCOUNTS_DIR);
      const name = await nextAvailableAccountName("account");
      await fsp.copyFile(AUTH_PATH, accountPath(name));
      await fsp.writeFile(CURRENT_NAME_PATH, `${name}
`, "utf8");
      return name;
    }
    async function nextAvailableAccountName(baseName) {
      const accounts = new Set(await listAccountNames());
      if (!accounts.has(baseName)) return baseName;
      for (let index = 2; index < 1e4; index += 1) {
        const name = `${baseName}-${index}`;
        if (!accounts.has(name)) return name;
      }
      throw new Error("Could not find an available account name.");
    }
    async function switchAccount(rawName, api2) {
      const { fsp } = nodeDeps();
      const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
      const name = normalizeAccountName(rawName);
      const source = accountPath(name);
      if (!await pathExists(source)) throw new Error(`Saved account not found: ${name}`);
      await ensureDir(CODEX_DIR);
      await fsp.copyFile(source, AUTH_PATH);
      await fsp.writeFile(CURRENT_NAME_PATH, `${name}
`, "utf8");
      api2?.log?.info?.(`[account-switcher] switched auth file to ${name}; app relaunch required`);
      return readState({
        notice: `Switched to ${name}. Relaunching Codex to apply it.`,
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
      return readState({ notice: `Removed saved account ${name}.` });
    }
    async function clearActiveAuth(api2) {
      const { fsp, path } = nodeDeps();
      const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
      await ensureDir(CODEX_DIR);
      if (await pathExists(AUTH_PATH)) {
        const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
        await fsp.copyFile(AUTH_PATH, path.join(CODEX_DIR, `auth.account-switcher-backup-${stamp}.json`));
        await fsp.rm(AUTH_PATH, { force: true });
      }
      await fsp.rm(CURRENT_NAME_PATH, { force: true });
      api2?.log?.info?.("[account-switcher] cleared active auth file; app relaunch required");
      return readState({
        notice: "Cleared active auth. Relaunching Codex to show the login screen.",
        requiresAppRelaunch: true
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

// src/ui-components.js
var require_ui_components = __commonJS({
  "src/ui-components.js"(exports2, module2) {
    var { protectInteractiveControl } = require_dom_utils();
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
      element.style.transition = "background-color 120ms ease, color 120ms ease, transform 80ms ease";
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
          transform: "scale(0.98)"
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
          transform: "scale(0.94)"
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
          transform: "scale(0.98)"
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
        "width:calc(100% - 16px)",
        "margin:4px 8px 8px",
        "padding:10px",
        "border-top:1px solid var(--color-token-border-default,rgba(255,255,255,.12))",
        "border-bottom:1px solid var(--color-token-border-default,rgba(255,255,255,.12))",
        "color:var(--color-token-text-primary,currentColor)",
        "cursor:default",
        "user-select:none"
      ].join(";");
      return panel;
    }
    function setPanelStatus(panel, text) {
      panel.textContent = "";
      const status = document.createElement("div");
      status.textContent = text;
      status.style.cssText = "font-size:12px;color:var(--color-token-text-secondary,currentColor);padding:2px 0;";
      panel.appendChild(status);
    }
    function accountDisplayName(accountState, name, options = {}) {
      const email = accountState?.accountEmails?.[name];
      const suffix = accountState?.current === name && options.includeCurrent !== false ? " (current)" : "";
      return email ? `${email}${suffix}` : `${name}${suffix}`;
    }
    module2.exports = {
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
      accountDisplayName
    };
  }
});

// src/ui-settings.js
var require_ui_settings = __commonJS({
  "src/ui-settings.js"(exports2, module2) {
    var { errorMessage: errorMessage2 } = require_utils();
    var { invoke } = require_ipc();
    var {
      settingsButton,
      settingsSection,
      settingsCard,
      settingsRowShell,
      settingsInfoRow,
      settingsActionRow,
      settingsStatus,
      accountDisplayName,
      bindButtonAction
    } = require_ui_components();
    async function renderAccountsPage(state, root) {
      root.textContent = "";
      root.appendChild(settingsStatus("Loading accounts..."));
      try {
        const accountState = await invoke(state, "state");
        renderAccountsPageState(state, root, accountState);
      } catch (error) {
        root.textContent = "";
        root.appendChild(settingsStatus(errorMessage2(error), true));
      }
    }
    function renderAccountsPageState(state, root, accountState) {
      root.textContent = "";
      const intro = settingsSection("Account profiles");
      const introCard = settingsCard();
      const currentName = accountState.current || (accountState.hasActiveAuth ? "Unsaved active account" : "No active account");
      const currentValue = accountState.current ? accountDisplayName(accountState, accountState.current, { includeCurrent: false }) : currentName;
      introCard.appendChild(
        settingsInfoRow(
          "Current account",
          currentValue,
          accountState.hasActiveAuth ? "The active session is stored in ~/.codex/auth.json." : "Codex does not currently have an auth.json file."
        )
      );
      intro.appendChild(introCard);
      root.appendChild(intro);
      const actions = settingsSection("Actions");
      const actionCard = settingsCard();
      actionCard.appendChild(
        settingsActionRow(
          "Add another account",
          "Back up and clear active auth, then reload Codex to show the login screen.",
          "Prepare",
          () => clearActiveFromSettings(state, root)
        )
      );
      actionCard.appendChild(
        settingsActionRow(
          "Refresh profiles",
          "Reload saved accounts from ~/.codex/auth_accounts.",
          "Refresh",
          () => renderAccountsPage(state, root)
        )
      );
      actions.appendChild(actionCard);
      root.appendChild(actions);
      const saved = settingsSection("Saved accounts");
      const savedCard = settingsCard();
      const accounts = Array.isArray(accountState.accounts) ? accountState.accounts : [];
      if (!accounts.length) {
        savedCard.appendChild(
          settingsInfoRow("No saved accounts", "Sign in and refresh to autosave the active account.", "")
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
      desc.textContent = accountState.current === name ? "This profile matches the active auth file." : "Saved account profile.";
      left.appendChild(desc);
      row.appendChild(left);
      const actionsEl = document.createElement("div");
      actionsEl.className = "flex shrink-0 items-center gap-2";
      const switchButton = settingsButton("Switch");
      switchButton.disabled = accountState.current === name;
      bindButtonAction(
        switchButton,
        () => runSettingsAction(state, root, "switch", { name }, "Switching account...")
      );
      actionsEl.appendChild(switchButton);
      const removeButton = settingsButton("Delete");
      bindButtonAction(removeButton, () => {
        runSettingsAction(state, root, "delete", { name }, "Removing account...");
      });
      actionsEl.appendChild(removeButton);
      row.appendChild(actionsEl);
      return row;
    }
    function clearActiveFromSettings(state, root) {
      runSettingsAction(state, root, "clear-active", {}, "Preparing new login...");
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
          error: errorMessage2(error)
        });
      }
    }
    function authReloadMessage(action, accountState) {
      if (action === "clear-active") {
        return "Auth cleared. Relaunching Codex to show the login screen...";
      }
      const email = accountState.current ? accountDisplayName(accountState, accountState.current, { includeCurrent: false }) : "selected account";
      return `Switched to ${email}. Relaunching Codex to apply it...`;
    }
    function scheduleAppRelaunch(state, root) {
      window.setTimeout(() => {
        invoke(state, "relaunch").catch((error) => {
          root.textContent = "";
          root.appendChild(settingsStatus(`Relaunch failed: ${errorMessage2(error)}`, true));
        });
      }, 1200);
    }
    module2.exports = {
      renderAccountsPage,
      renderAccountsPageState
    };
  }
});

// src/ui-popup.js
var require_ui_popup = __commonJS({
  "src/ui-popup.js"(exports2, module2) {
    var { errorMessage: errorMessage2 } = require_utils();
    var { invoke } = require_ipc();
    var { protectInteractiveControl } = require_dom_utils();
    var { renderAccountsPageState } = require_ui_settings();
    var {
      smallButton,
      iconButton,
      accountPanelShell,
      setPanelStatus,
      accountDisplayName,
      bindButtonAction
    } = require_ui_components();
    function renderAccountPanel(state, panel, accountState) {
      panel.textContent = "";
      panel.setAttribute("data-codexpp-account-switcher", "panel");
      const header = document.createElement("div");
      header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;";
      const title = document.createElement("div");
      title.textContent = "Codex accounts";
      title.style.cssText = "font-size:13px;font-weight:500;color:var(--color-token-text-primary,currentColor);";
      header.appendChild(title);
      panel.appendChild(header);
      const accounts = Array.isArray(accountState.accounts) ? accountState.accounts : [];
      if (accounts.length > 0) {
        panel.appendChild(accountSelectControl(state, panel, accountState, accounts));
      }
      const list = document.createElement("div");
      list.style.cssText = "display:flex;flex-direction:column;gap:4px;";
      if (accounts.length === 0) {
        const empty = document.createElement("div");
        empty.textContent = accountState.hasActiveAuth ? "No saved accounts yet." : "No active account. Restart Codex and log in.";
        empty.style.cssText = "font-size:12px;color:var(--color-token-text-secondary,currentColor);padding:2px 0 4px;";
        list.appendChild(empty);
      }
      for (const name of accounts) {
        list.appendChild(accountRow(state, panel, accountState, name));
      }
      panel.appendChild(list);
      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:8px;";
      const add = smallButton("Add another");
      add.title = "Back up and clear active auth, then reload Codex to show the login screen.";
      bindButtonAction(add, () => {
        void clearActiveForNewLogin(state, panel);
      });
      actions.appendChild(add);
      const refresh = iconButton("Refresh", "R");
      bindButtonAction(refresh, () => {
        void refreshPanel(state, panel);
      });
      actions.appendChild(refresh);
      panel.appendChild(actions);
      if (accountState.notice || accountState.error) {
        const note = document.createElement("div");
        note.textContent = accountState.notice || accountState.error;
        note.style.cssText = "margin-top:7px;font-size:11px;line-height:1.3;color:" + (accountState.error ? "var(--color-token-text-error,#ff6b6b)" : "var(--color-token-text-secondary,currentColor)") + ";";
        panel.appendChild(note);
      }
    }
    function accountSelectControl(state, panel, accountState, accounts) {
      const wrap = document.createElement("label");
      wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;margin-bottom:8px;";
      const label = document.createElement("span");
      label.textContent = "Switch account";
      label.style.cssText = "font-size:11px;color:var(--color-token-text-secondary,currentColor);";
      wrap.appendChild(label);
      const select = document.createElement("select");
      select.setAttribute("aria-label", "Switch Codex account");
      select.style.cssText = [
        "box-sizing:border-box",
        "width:100%",
        "height:30px",
        "border:1px solid color-mix(in srgb,currentColor 16%,transparent)",
        "border-radius:6px",
        "padding:0 8px",
        "background:var(--color-background-panel,var(--color-token-bg-primary,transparent))",
        "color:var(--color-token-text-primary,currentColor)",
        "font:inherit",
        "font-size:12px",
        "cursor:pointer"
      ].join(";");
      const current = accountState.current || "";
      if (!current) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Unsaved active account";
        select.appendChild(option);
      }
      for (const name of accounts) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = accountDisplayName(accountState, name);
        select.appendChild(option);
      }
      select.value = current;
      protectInteractiveControl(select, { preventClickDefault: false });
      select.addEventListener("change", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const name = select.value;
        if (!name || name === accountState.current) return;
        void runPanelAction(state, panel, "switch", { name }, "Switching...");
      });
      wrap.appendChild(select);
      return wrap;
    }
    function accountRow(state, panel, accountState, name) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:28px;border-radius:6px;padding:3px 4px 3px 8px;background:" + (accountState.current === name ? "color-mix(in srgb,var(--color-token-text-link-foreground,currentColor) 14%,transparent)" : "transparent") + ";";
      const label = document.createElement("button");
      label.type = "button";
      label.textContent = accountDisplayName(accountState, name);
      label.title = accountDisplayName(accountState, name, { includeCurrent: false });
      label.style.cssText = "min-width:0;flex:1 1 auto;border:0;background:transparent;color:var(--color-token-text-primary,currentColor);font:inherit;font-size:12px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;";
      protectInteractiveControl(label);
      bindButtonAction(label, () => {
        if (accountState.current === name) return;
        void runPanelAction(state, panel, "switch", { name }, "Switching...");
      });
      row.appendChild(label);
      const remove = iconButton(`Remove ${name}`, "x");
      bindButtonAction(remove, () => {
        runPanelAction(state, panel, "delete", { name }, "Removing...");
      });
      row.appendChild(remove);
      return row;
    }
    function clearActiveForNewLogin(state, panel) {
      runPanelAction(state, panel, "clear-active", {}, "Clearing active auth...");
    }
    async function runPanelAction(state, panel, action, payload, loadingText) {
      setPanelStatus(panel, loadingText);
      try {
        const accountState = await invoke(state, action, payload);
        if (action === "switch" || action === "clear-active") {
          setPanelStatus(panel, authReloadMessage(action, accountState));
          scheduleAppRelaunch(state, panel);
          return;
        }
        renderAccountPanel(state, panel, accountState);
        if (state.settingsRoot?.isConnected) {
          renderAccountsPageState(state, state.settingsRoot, accountState);
        }
      } catch (error) {
        renderAccountPanel(state, panel, {
          ...state.lastState || { accounts: [], current: null, hasActiveAuth: false },
          error: errorMessage2(error)
        });
      }
    }
    function authReloadMessage(action, accountState) {
      if (action === "clear-active") {
        return "Auth cleared. Relaunching Codex to show the login screen...";
      }
      const email = accountState.current ? accountDisplayName(accountState, accountState.current, { includeCurrent: false }) : "selected account";
      return `Switched to ${email}. Relaunching Codex to apply it...`;
    }
    function scheduleAppRelaunch(state, panel) {
      window.setTimeout(() => {
        invoke(state, "relaunch").catch((error) => {
          setPanelStatus(panel, `Relaunch failed: ${errorMessage2(error)}`);
        });
      }, 1200);
    }
    async function refreshPanel(state, panel) {
      setPanelStatus(panel, "Loading accounts...");
      try {
        const accountState = await invoke(state, "state");
        renderAccountPanel(state, panel, accountState);
      } catch (error) {
        setPanelStatus(panel, errorMessage2(error));
      }
    }
    module2.exports = { renderAccountPanel, accountPanelShell, refreshPanel };
  }
});

// src/renderer.js
var require_renderer = __commonJS({
  "src/renderer.js"(exports2, module2) {
    var { compactText, isVisible, findMenuItem } = require_dom_utils();
    var { accountPanelShell, renderAccountPanel, refreshPanel } = require_ui_popup();
    var { renderAccountsPage } = require_ui_settings();
    function startRenderer2(state) {
      if (typeof state.api.settings?.registerPage === "function") {
        const pageHandle = state.api.settings.registerPage({
          id: "accounts",
          title: "Accounts",
          description: "Save and switch Codex auth profiles.",
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
      schedule();
    }
    function scanForAccountMenu(state) {
      const menu = findSettingsAccountMenu();
      if (!menu) return;
      if (menu.querySelector("[data-codexpp-account-switcher]")) return;
      installAccountSwitcher(state, menu);
    }
    function findSettingsAccountMenu() {
      const candidates = Array.from(
        document.querySelectorAll(
          '[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]'
        )
      );
      for (const candidate of candidates) {
        if (!(candidate instanceof HTMLElement) || !isVisible(candidate)) continue;
        const text = compactText(candidate);
        if (!/\bsettings\b/i.test(text) || !/\blog out\b/i.test(text)) continue;
        if (!/\brate limits remaining\b/i.test(text) && !/\bpersonal account\b/i.test(text)) continue;
        return candidate.matches("[data-radix-popper-content-wrapper]") ? candidate.querySelector('[role="menu"], [data-radix-menu-content]') || candidate : candidate;
      }
      return findSidebarAccountMenuByItems();
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
          if (/\brate limits remaining\b/i.test(text) || /\bpersonal account\b/i.test(text)) {
            return node;
          }
        }
        node = node.parentElement;
      }
      return null;
    }
    function installAccountSwitcher(state, menu) {
      const target = findMenuItem(menu, /settings/i) || findMenuItem(menu, /rate limits remaining/i) || Array.from(menu.children).find((child) => child instanceof HTMLElement);
      if (!(target instanceof HTMLElement) || !target.parentElement) return;
      const panel = accountPanelShell(target);
      target.before(panel);
      refreshPanel(state, panel).catch((error) => {
        state.api.log.warn("[account-switcher] panel load failed", String(error));
      });
    }
    module2.exports = { startRenderer: startRenderer2 };
  }
});

// index.js
var { GLOBAL_SERVICE_KEY, IPC_HANDLER_KEY, IPC_CHANNEL } = require_constants();
var { createAccountService: createAccountService2 } = require_account_service();
var { startRenderer } = require_renderer();
module.exports = {
  start(api2) {
    if (api2.process === "main") {
      startMain(api2);
      return;
    }
    const state = {
      api: api2,
      observer: null,
      pending: 0,
      disposed: false,
      disposers: [],
      lastState: null,
      settingsRoot: null
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
  const service = createAccountService2(api2);
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
