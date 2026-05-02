const { errorMessage } = require("./utils");
const { invoke } = require("./ipc");
const { protectInteractiveControl } = require("./dom-utils");
const { renderAccountsPageState } = require("./ui-settings");
const {
  smallButton,
  iconButton,
  accountPanelShell,
  setPanelStatus,
  accountDisplayName,
  bindButtonAction,
} = require("./ui-components");

// ─── Panel render ─────────────────────────────────────────────────────────────

function renderAccountPanel(state, panel, accountState) {
  panel.textContent = "";
  panel.setAttribute("data-codexpp-account-switcher", "panel");

  // Header row
  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;";

  const title = document.createElement("div");
  title.textContent = "Accounts";
  title.style.cssText =
    "font-size:13px;font-weight:500;color:var(--color-token-text-primary,currentColor);";
  header.appendChild(title);
  panel.appendChild(header);

  const accounts = Array.isArray(accountState.accounts) ? accountState.accounts : [];

  if (accounts.length > 0) {
    panel.appendChild(accountSelectControl(state, panel, accountState, accounts));
  }

  // Account rows
  const list = document.createElement("div");
  list.style.cssText = "display:flex;flex-direction:column;gap:4px;";

  if (accounts.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = accountState.hasActiveAuth
      ? "No saved accounts yet."
      : "No active session. Relaunch and sign in.";
    empty.style.cssText =
      "font-size:12px;color:var(--color-token-text-secondary,currentColor);padding:2px 0 4px;";
    list.appendChild(empty);
  }

  for (const name of accounts) {
    list.appendChild(accountRow(state, panel, accountState, name));
  }
  panel.appendChild(list);

  // Footer: new sign-in + refresh
  const actions = document.createElement("div");
  actions.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:8px;";

  const add = smallButton("New sign-in");
  add.title = "Back up the current session, clear auth, and relaunch Codex for sign-in.";
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

  // Notice / error
  if (accountState.notice || accountState.error) {
    const note = document.createElement("div");
    note.textContent = accountState.notice || accountState.error;
    note.style.cssText =
      "margin-top:7px;font-size:11px;line-height:1.3;color:" +
      (accountState.error
        ? "var(--color-token-text-error,#ff6b6b)"
        : "var(--color-token-text-secondary,currentColor)") +
      ";";
    panel.appendChild(note);
  }
}

// ─── Switch dropdown ──────────────────────────────────────────────────────────

function accountSelectControl(state, panel, accountState, accounts) {
  const wrap = document.createElement("label");
  wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;margin-bottom:8px;";

  const label = document.createElement("span");
  label.textContent = "Switch to";
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
    "cursor:pointer",
  ].join(";");

  const current = accountState.current || "";
  if (!current) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Unsaved account";
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
    void runPanelAction(state, panel, "switch", { name }, "Switching account...");
  });

  wrap.appendChild(select);
  return wrap;
}

// ─── Per-account row ──────────────────────────────────────────────────────────

function accountRow(state, panel, accountState, name) {
  const row = document.createElement("div");
  row.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:8px;" +
    "min-height:28px;border-radius:6px;padding:3px 4px 3px 8px;background:" +
    (accountState.current === name
      ? "color-mix(in srgb,var(--color-token-text-link-foreground,currentColor) 14%,transparent)"
      : "transparent") +
    ";";

  const label = document.createElement("button");
  label.type = "button";
  label.textContent = accountDisplayName(accountState, name);
  label.title = accountDisplayName(accountState, name, { includeCurrent: false });
  label.style.cssText =
    "min-width:0;flex:1 1 auto;border:0;background:transparent;" +
    "color:var(--color-token-text-primary,currentColor);font:inherit;font-size:12px;" +
    "text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;";
  protectInteractiveControl(label);
  bindButtonAction(label, () => {
    if (accountState.current === name) return;
    void runPanelAction(state, panel, "switch", { name }, "Switching account...");
  });
  row.appendChild(label);

  const remove = iconButton(`Remove ${name}`, "x");
  bindButtonAction(remove, () => {
    runPanelAction(state, panel, "delete", { name }, "Removing...");
  });
  row.appendChild(remove);
  return row;
}

// ─── User-initiated actions ───────────────────────────────────────────────────

function clearActiveForNewLogin(state, panel) {
  runPanelAction(state, panel, "clear-active", {}, "Preparing sign-in...");
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
      ...(state.lastState || { accounts: [], current: null, hasActiveAuth: false }),
      error: errorMessage(error),
    });
  }
}

function authReloadMessage(action, accountState) {
  if (action === "clear-active") {
    return "Session cleared. Relaunching Codex for sign-in...";
  }
  const email = accountState.current
    ? accountDisplayName(accountState, accountState.current, { includeCurrent: false })
    : "selected account";
  return `Switched to ${email}. Relaunching Codex...`;
}

function scheduleAppRelaunch(state, panel) {
  window.setTimeout(() => {
    invoke(state, "relaunch").catch((error) => {
      setPanelStatus(panel, `Relaunch failed: ${errorMessage(error)}`);
    });
  }, 1200);
}

async function refreshPanel(state, panel) {
  setPanelStatus(panel, "Loading saved accounts...");
  try {
    const accountState = await invoke(state, "state");
    renderAccountPanel(state, panel, accountState);
  } catch (error) {
    setPanelStatus(panel, errorMessage(error));
  }
}

module.exports = { renderAccountPanel, accountPanelShell, refreshPanel };
