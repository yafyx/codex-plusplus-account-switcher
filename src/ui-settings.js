const { errorMessage } = require("./utils");
const { invoke } = require("./ipc");
const {
  settingsButton,
  settingsSection,
  settingsCard,
  settingsRowShell,
  settingsInfoRow,
  settingsActionRow,
  settingsStatus,
  accountDisplayName,
  bindButtonAction,
} = require("./ui-components");

// ─── Page lifecycle ───────────────────────────────────────────────────────────

async function renderAccountsPage(state, root) {
  root.textContent = "";
  root.appendChild(settingsStatus("Loading saved accounts..."));
  try {
    const accountState = await invoke(state, "state");
    renderAccountsPageState(state, root, accountState);
  } catch (error) {
    root.textContent = "";
    root.appendChild(settingsStatus(errorMessage(error), true));
  }
}

function renderAccountsPageState(state, root, accountState) {
  root.textContent = "";

  // ── Current account info ─────────────────────────────────────────────────
  const intro = settingsSection("Active session");
  const introCard = settingsCard();
  const currentName =
    accountState.current ||
    (accountState.hasActiveAuth ? "Unsaved account" : "No active session");
  const currentValue = accountState.current
    ? accountDisplayName(accountState, accountState.current, { includeCurrent: false })
    : currentName;
  introCard.appendChild(
    settingsInfoRow(
      "Signed in as",
      currentValue,
      accountState.hasActiveAuth
        ? "Codex is using the session stored in ~/.codex/auth.json."
        : "No active auth file exists at ~/.codex/auth.json.",
    ),
  );
  intro.appendChild(introCard);
  root.appendChild(intro);

  // ── Actions ──────────────────────────────────────────────────────────────
  const actions = settingsSection("Account setup");
  const actionCard = settingsCard();
  actionCard.appendChild(
    settingsActionRow(
      "Sign in to another account",
      "Back up the current session, clear auth, and relaunch Codex for sign-in.",
      "Start sign-in",
      () => clearActiveFromSettings(state, root),
    ),
  );
  actionCard.appendChild(
    settingsActionRow(
      "Refresh saved accounts",
      "Rescan saved sessions in ~/.codex/auth_accounts.",
      "Refresh",
      () => renderAccountsPage(state, root),
    ),
  );
  actions.appendChild(actionCard);
  root.appendChild(actions);

  // ── Saved accounts list ──────────────────────────────────────────────────
  const saved = settingsSection("Saved accounts");
  const savedCard = settingsCard();
  const accounts = Array.isArray(accountState.accounts) ? accountState.accounts : [];
  if (!accounts.length) {
    savedCard.appendChild(
      settingsInfoRow(
        "No saved accounts yet",
        "None found",
        "Use Sign in to another account to create one.",
      ),
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

// ─── Per-account row ──────────────────────────────────────────────────────────

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
  desc.textContent =
    accountState.current === name
      ? "Active in this Codex window."
      : "Ready to switch.";
  left.appendChild(desc);
  row.appendChild(left);

  const actionsEl = document.createElement("div");
  actionsEl.className = "flex shrink-0 items-center gap-2";

  const switchButton = settingsButton("Switch");
  switchButton.disabled = accountState.current === name;
  bindButtonAction(switchButton, () =>
    runSettingsAction(state, root, "switch", { name }, "Switching account..."),
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

// ─── User-initiated actions ───────────────────────────────────────────────────

function clearActiveFromSettings(state, root) {
  runSettingsAction(state, root, "clear-active", {}, "Preparing sign-in...");
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

function scheduleAppRelaunch(state, root) {
  window.setTimeout(() => {
    invoke(state, "relaunch").catch((error) => {
      root.textContent = "";
      root.appendChild(settingsStatus(`Relaunch failed: ${errorMessage(error)}`, true));
    });
  }, 1200);
}

module.exports = {
  renderAccountsPage,
  renderAccountsPageState,
};
