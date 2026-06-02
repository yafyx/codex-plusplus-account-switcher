const { compactText, findMenuItem } = require("./dom-utils");
const {
  RATE_LIMITS_PATTERN,
  USAGE_REMAINING_PATTERN,
  findSettingsAccountMenu,
  hasAccountMenuMarker,
  isAccountMenuText,
} = require("./menu-finder");
const { accountPanelShell, renderAccountPanel, refreshPanel } = require("./ui-popup");
const { renderAccountsPage } = require("./ui-settings");

/**
 * Bootstraps the renderer-side of the account switcher:
 *  1. Registers the dedicated Settings page (if the SDK supports it).
 *  2. Sets up a MutationObserver + pointer/key listeners to inject the
 *     floating panel into Codex's account menu whenever it appears.
 *
 * @param {object} state - Shared renderer state created in index.js
 */
function startRenderer(state) {
  // ── Settings page registration ────────────────────────────────────────────
  if (typeof state.api.settings?.registerPage === "function") {
    const pageHandle = state.api.settings.registerPage({
      id: "accounts",
      title: "Accounts",
      description: "Switch Codex accounts and manage saved sessions.",
      iconSvg:
        '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-sm inline-block align-middle" aria-hidden="true">' +
        '<path d="M10 10.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" stroke="currentColor" stroke-width="1.5"/>' +
        '<path d="M4.75 16.25c.7-2.15 2.65-3.5 5.25-3.5s4.55 1.35 5.25 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        "</svg>",
      render: (root) => {
        state.settingsRoot = root;
        renderAccountsPage(state, root);
      },
    });
    state.disposers.push(() => pageHandle.unregister?.());
  } else {
    state.api.log.warn(
      "[account-switcher] registerPage unavailable; account controls will only appear in the account menu.",
    );
  }

  // ── Observer + polling: inject panel into the account popup ──────────────
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
  // Poll every 300 ms as a safety net in case the popover appears without
  // triggering a DOM mutation (e.g. CSS-driven show/hide of a persisted node).
  state.pollTimer = window.setInterval(schedule, 300);
  state.disposers.push(() => window.clearInterval(state.pollTimer));
  schedule();
}

// ─── Account-menu install ─────────────────────────────────────────────────────

function scanForAccountMenu(state) {
  const menu = findSettingsAccountMenu();
  if (!menu) return;
  if (menu.querySelector("[data-codexpp-account-switcher]")) return;
  installAccountSwitcher(state, menu);
}

function installAccountSwitcher(state, menu) {
  const target =
    findMenuItem(menu, /settings/i) ||
    findMenuItem(menu, USAGE_REMAINING_PATTERN) ||
    findMenuItem(menu, RATE_LIMITS_PATTERN) ||
    findMenuItem(menu, /personal account/i) ||
    Array.from(menu.children).find((child) => child instanceof HTMLElement);
  if (!(target instanceof HTMLElement) || !target.parentElement) return;

  const panel = accountPanelShell(target);

  // When anchoring on "Personal account", remove the copy-id row
  // above it so the panel replaces it cleanly.
  if (/\bpersonal account\b/i.test(compactText(target))) {
    const prev = target.previousElementSibling;
    if (prev instanceof HTMLElement) prev.remove();
  }

  target.before(panel);
  // Attach an explicit catch so the promise rejection is never silently swallowed.
  refreshPanel(state, panel).catch((error) => {
    state.api.log.warn("[account-switcher] panel load failed", String(error));
  });
}

module.exports = {
  startRenderer,
  _test: {
    hasAccountMenuMarker,
    isAccountMenuText,
  },
};
