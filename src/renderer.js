const { compactText, isVisible, findMenuItem } = require("./dom-utils");
const { accountPanelShell, renderAccountPanel, refreshPanel } = require("./ui-popup");
const { renderAccountsPage } = require("./ui-settings");

const MENU_CONTAINER_SELECTOR =
  '[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]';
const MENU_COMMAND_SELECTOR = 'button, a, [role="button"], [role="menuitem"]';
const PERSONAL_ACCOUNT_PATTERN = /\bpersonal account\b/i;
const USAGE_REMAINING_PATTERN = /\busage remaining\b/i;
const RATE_LIMITS_PATTERN = /\brate limits(?: remaining)?\b/i;

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

// ─── Account-menu detection ───────────────────────────────────────────────────

function scanForAccountMenu(state) {
  const menu = findSettingsAccountMenu();
  if (!menu) return;
  if (menu.querySelector("[data-codexpp-account-switcher]")) return;
  installAccountSwitcher(state, menu);
}

/**
 * Finds the settings/account popover that Codex opens from the gear button
 * in the bottom-left sidebar.
 *
 * Strategy (in order):
 *  1. Walk every visible element on the page.  If one contains "Personal
 *     account" text, walk up to the nearest popover/menu container and return
 *     it.  This catches the popover regardless of what Radix component it
 *     uses (Popover, DropdownMenu, Dialog, etc.).
 *  2. Classic strict check on `[role="menu"]` / `[data-radix-menu-content]`.
 *  3. Classic fallbacks via rate-limits anchor or sidebar-item anchor.
 */
function findSettingsAccountMenu() {
  const commandMenu = findAccountMenuByCommands();
  if (commandMenu) return commandMenu;

  // ── Strategy 1: walk ALL visible elements for "Personal account" ──────────
  const all = document.querySelectorAll('*');
  for (const el of all) {
    if (!(el instanceof HTMLElement) || !isVisible(el)) continue;
    if (!PERSONAL_ACCOUNT_PATTERN.test(compactText(el))) continue;

    const menu = findAccountMenuContainer(el);
    if (menu) return menu;
  }

  // ── Strategy 2: strict legacy check on menu elements ──────────────────────
  const menus = document.querySelectorAll('[role="menu"], [data-radix-menu-content]');
  for (const candidate of menus) {
    if (!(candidate instanceof HTMLElement) || !isVisible(candidate)) continue;
    const text = compactText(candidate);
    if (!isAccountMenuText(text)) continue;
    return candidate;
  }

  // ── Strategy 3: fallback heuristics ───────────────────────────────────────
  return findAccountMenuByUsageItem() || findSidebarAccountMenuByItems();
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
        const hasMarker =
          hasAccountMenuMarker(compactText(node)) ||
          commands.some((item) => node.contains(item) && hasAccountMenuMarker(compactText(item)));
        if (hasLogout && hasMarker) return normalizeMenuContainer(node);
      }
      node = node.parentElement;
    }
  }

  return null;
}

function visibleMenuCommands(root = document) {
  return Array.from(root.querySelectorAll(MENU_COMMAND_SELECTOR)).filter((element) => {
    return (
      element instanceof HTMLElement &&
      isVisible(element) &&
      !element.closest("[data-codexpp-account-switcher]")
    );
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
  return (
    PERSONAL_ACCOUNT_PATTERN.test(text) ||
    USAGE_REMAINING_PATTERN.test(text) ||
    RATE_LIMITS_PATTERN.test(text)
  );
}

function findAccountMenuByUsageItem() {
  const usageItem = findUsageItem();
  if (!usageItem) return null;
  return findAccountMenuContainer(usageItem);
}

function findUsageItem(root = document) {
  const candidates = root.querySelectorAll(MENU_COMMAND_SELECTOR);
  for (const element of candidates) {
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
    document.querySelectorAll('button, a, [role="menuitem"], [data-radix-collection-item]'),
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
