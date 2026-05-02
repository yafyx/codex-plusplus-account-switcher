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
} = require("./ui-components");

// ─── Page lifecycle ───────────────────────────────────────────────────────────

async function renderAccountsPage(state, root) {
  root.textContent = "";
  root.appendChild(settingsStatus("Loading accounts..."));
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
  const intro = settingsSection("Account profiles");
  const introCard = settingsCard();
  const currentName =
    accountState.current ||
    (accountState.hasActiveAuth ? "Unsaved active account" : "No active account");
  introCard.appendChild(
    settingsInfoRow(
      "Current account",
      currentName,
      accountState.hasActiveAuth
        ? "The active session is stored in ~/.codex/auth.json."
        : "Codex does not currently have an auth.json file.",
    ),
  );
  intro.appendChild(introCard);
  root.appendChild(intro);

  // ── Actions ──────────────────────────────────────────────────────────────
  const actions = settingsSection("Actions");
  const actionCard = settingsCard();
  actionCard.appendChild(
    settingsActionRow(
      "Save current account",
      "Store the current ~/.codex/auth.json as a named profile.",
      "Save",
      () => saveCurrentFromSettings(state, root),
    ),
  );
  actionCard.appendChild(
    settingsActionRow(
      "Add another account",
      "Back up and clear active auth, then restart Codex and log in with another account.",
      "Prepare",
      () => clearActiveFromSettings(state, root),
    ),
  );
  actionCard.appendChild(
    settingsActionRow(
      "Refresh profiles",
      "Reload saved accounts from ~/.codex/auth_accounts.",
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
      settingsInfoRow("No saved accounts", "Use Save current account after signing in.", ""),
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
  title.textContent = accountState.current === name ? `${name} (current)` : name;
  left.appendChild(title);

  const desc = document.createElement("div");
  desc.className = "text-token-text-secondary min-w-0 text-sm";
  desc.textContent =
    accountState.current === name
      ? "This profile matches the active auth file."
      : "Saved account profile.";
  left.appendChild(desc);
  row.appendChild(left);

  const actionsEl = document.createElement("div");
  actionsEl.className = "flex shrink-0 items-center gap-2";

  const switchButton = settingsButton("Switch");
  switchButton.disabled = accountState.current === name;
  switchButton.addEventListener("click", () =>
    runSettingsAction(state, root, "switch", { name }, "Switching account..."),
  );
  actionsEl.appendChild(switchButton);

  const removeButton = settingsButton("Delete");
  removeButton.addEventListener("click", () => {
    if (!window.confirm(`Remove saved account "${name}"? This does not log out the active session.`))
      return;
    runSettingsAction(state, root, "delete", { name }, "Removing account...");
  });
  actionsEl.appendChild(removeButton);
  row.appendChild(actionsEl);
  return row;
}

// ─── User-initiated actions ───────────────────────────────────────────────────

async function saveCurrentFromSettings(state, root) {
  const raw = window.prompt("Save current Codex account as:", "");
  if (raw == null) return; // User cancelled.
  const name = raw.trim();
  if (!name) {
    window.alert("Account name cannot be empty.");
    return;
  }
  await runSettingsAction(state, root, "save", { name }, "Saving account...");
}

async function clearActiveFromSettings(state, root) {
  const confirmed = window.confirm(
    "This backs up and clears the active Codex auth file. Restart Codex, log in with the new account, then use Save current account. Continue?",
  );
  if (!confirmed) return;
  await runSettingsAction(state, root, "clear-active", {}, "Preparing new login...");
}

async function runSettingsAction(state, root, action, payload, loadingText) {
  root.textContent = "";
  root.appendChild(settingsStatus(loadingText));
  try {
    const accountState = await invoke(state, action, payload);
    renderAccountsPageState(state, root, accountState);
  } catch (error) {
    renderAccountsPageState(state, root, {
      ...(state.lastState || { accounts: [], current: null, hasActiveAuth: false }),
      error: errorMessage(error),
    });
  }
}

module.exports = {
  renderAccountsPage,
  renderAccountsPageState,
};
