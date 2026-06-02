const { compactText, isVisible } = require("./dom-utils");

const MENU_CONTAINER_SELECTOR =
  '[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]';
const MENU_COMMAND_SELECTOR = 'button, a, [role="button"], [role="menuitem"]';
const PERSONAL_ACCOUNT_PATTERN = /\bpersonal account\b/i;
const USAGE_REMAINING_PATTERN = /\busage remaining\b/i;
const RATE_LIMITS_PATTERN = /\brate limits(?: remaining)?\b/i;

function findSettingsAccountMenu() {
  return (
    findAccountMenuByCommands() ||
    findAccountMenuByScopedMarkers() ||
    findAccountMenuByPageMarker() ||
    findAccountMenuByLegacyMenuText() ||
    findAccountMenuByUsageItem() ||
    findSidebarAccountMenuByItems()
  );
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
  const candidates = root.querySelectorAll(selector);
  for (const element of candidates) {
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

module.exports = {
  RATE_LIMITS_PATTERN,
  USAGE_REMAINING_PATTERN,
  findSettingsAccountMenu,
  hasAccountMenuMarker,
  isAccountMenuText,
};
