const { compactText, isVisible, findMenuItem } = require("./dom-utils");
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

  // ── Mutation observer: inject panel into the account popup ────────────────
  const schedule = () => {
    if (state.disposed || state.pending) return;
    state.pending = window.requestAnimationFrame(() => {
      state.pending = 0;
      scanForAccountMenu(state);
    });
  };

  state.observer = new MutationObserver(schedule);
  state.observer.observe(document.documentElement, { childList: true, subtree: true });
  // Disconnect the observer when the tweak is stopped to avoid a memory leak.
  state.disposers.push(() => state.observer?.disconnect());
  document.addEventListener("pointerdown", schedule, true);
  document.addEventListener("keydown", schedule, true);
  state.disposers.push(() => document.removeEventListener("pointerdown", schedule, true));
  state.disposers.push(() => document.removeEventListener("keydown", schedule, true));
  schedule();
}

// ─── Account-menu detection ───────────────────────────────────────────────────

function scanForAccountMenu(state) {
  const menu = findSettingsAccountMenu();
  if (!menu) return;
  if (menu.querySelector("[data-codexpp-account-switcher]")) return;
  installAccountSwitcher(state, menu);
}

function findSettingsAccountMenu() {
  const candidates = Array.from(
    document.querySelectorAll(
      '[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]',
    ),
  );
  for (const candidate of candidates) {
    if (!(candidate instanceof HTMLElement) || !isVisible(candidate)) continue;
    const text = compactText(candidate);
    if (!/\bsettings\b/i.test(text) || !/\blog out\b/i.test(text)) continue;
    if (!/\brate limits remaining\b/i.test(text) && !/\bpersonal account\b/i.test(text)) continue;
    return candidate.matches("[data-radix-popper-content-wrapper]")
      ? candidate.querySelector('[role="menu"], [data-radix-menu-content]') || candidate
      : candidate;
  }
  return findSidebarAccountMenuByItems();
}

function findSidebarAccountMenuByItems() {
  const items = Array.from(
    document.querySelectorAll('button, a, [role="menuitem"], [data-radix-collection-item]'),
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
  const target =
    findMenuItem(menu, /settings/i) ||
    findMenuItem(menu, /rate limits remaining/i) ||
    Array.from(menu.children).find((child) => child instanceof HTMLElement);
  if (!(target instanceof HTMLElement) || !target.parentElement) return;

  const panel = accountPanelShell(target);
  target.before(panel);
  // Attach an explicit catch so the promise rejection is never silently swallowed.
  refreshPanel(state, panel).catch((error) => {
    state.api.log.warn("[account-switcher] panel load failed", String(error));
  });
}

module.exports = { startRenderer };
