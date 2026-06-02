const { errorMessage } = require("./utils");
const { invoke } = require("./ipc");
const { t } = require("./i18n");
const { protectInteractiveControl } = require("./dom-utils");
const { refreshUsageInBackground } = require("./usage-refresh");
const { accountRow } = require("./ui-account-row");
const { authReloadMessage } = require("./action-messages");
const { renderAccountsPageState } = require("./ui-settings");
const {
  accountPanelShell,
  setPanelStatus,
  addButtonFeedback,
  bindButtonAction,
  prefersReducedMotion,
} = require("./ui-components");
const {
  ACCOUNTS_PANEL_EASING,
  accountsBodyCss,
  accountsChevronTransform,
  accountsPanelDuration,
  createAccountsCollapsible,
} = require("./ui-collapsible");

const ACCOUNTS_CHEVRON_SIZE = "16";
const ACCOUNTS_CHEVRON_COLOR = "#5C5B56";
const ACCOUNTS_COLLAPSIBLE_KEY = "__codexppAccountsCollapsible";

// ─── Panel render ─────────────────────────────────────────────────────────────

function renderAccountPanel(state, panel, accountState) {
  panel.textContent = "";
  panel.setAttribute("data-codexpp-account-switcher", "panel");

  const accounts = Array.isArray(accountState.accounts) ? accountState.accounts : [];
  const expanded = state.accountsExpanded === true;

  const section = document.createElement("div");
  section.style.cssText = "display:flex;flex-direction:column;padding:0;";
  const header = accountsHeaderRow(state, panel, accountState, expanded);
  section.appendChild(header);

  const list = document.createElement("div");
  list.style.cssText =
    "display:flex;flex-direction:column;min-width:0;" +
    "gap:1px;padding:2px 0 4px;";

  if (accounts.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = accountState.hasActiveAuth
      ? t("accounts.emptySaved")
      : t("accounts.emptyActive");
    empty.style.cssText =
      "font-size:12px;color:var(--color-token-text-secondary,currentColor);" +
      "padding:2px var(--codexpp-menu-row-padding-right,24px) 4px var(--codexpp-menu-text-inset,64px);";
    list.appendChild(empty);
  }

  for (const name of accounts) {
    list.appendChild(accountRow(accountState, name, (accountName) => {
      void runPanelAction(state, panel, "switch", { name: accountName }, t("accounts.switching"));
    }));
  }

  list.appendChild(configureAccountsRow(state, panel));
  const body = document.createElement("div");
  body.setAttribute("data-codexpp-account-switcher-body", "accounts");
  body.style.cssText = accountsBodyCss(expanded);
  const bodyInner = document.createElement("div");
  bodyInner.style.cssText = "min-height:0;";
  bodyInner.appendChild(list);
  body.appendChild(bodyInner);
  section.appendChild(body);
  panel.appendChild(section);

  const notes = [];
  if (accountState.notice || accountState.error) {
    const note = document.createElement("div");
    note.setAttribute("data-codexpp-account-switcher-notice", "");
    note.textContent = accountState.notice || accountState.error;
    note.style.cssText =
      "padding:0 var(--codexpp-menu-row-padding-right,24px) 6px var(--codexpp-menu-text-inset,64px);font-size:11px;line-height:1.3;color:" +
      (accountState.error
        ? "var(--color-token-text-error,#ff6b6b)"
        : "var(--color-token-text-secondary,currentColor)") +
      ";";
    if (expanded) note.style.display = "block";
    else note.style.display = "none";
    notes.push(note);
    panel.appendChild(note);
  }

  panel[ACCOUNTS_COLLAPSIBLE_KEY] = createAccountsCollapsible(
    state,
    {
      body,
      header,
      chevron: header.querySelector("[data-accounts-chevron] svg"),
      notes,
    },
    expanded,
  );
}

function accountsHeaderRow(state, panel, accountState, expanded) {
  const metrics = nativeCollapsibleMetrics(panel);
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-expanded", expanded ? "true" : "false");
  button.style.cssText = [
    "width:100%",
    "border:0",
    "background:transparent",
    "color:var(--color-token-text-primary,currentColor)",
    "font:inherit",
    "font-size:13px",
    "line-height:1.25",
    "text-align:left",
    "border-radius:var(--codexpp-menu-row-radius,8px)",
    "min-height:var(--codexpp-menu-row-height,40px)",
    "padding:var(--codexpp-menu-row-padding-top,0) var(--codexpp-menu-row-padding-right,24px) var(--codexpp-menu-row-padding-bottom,0) var(--codexpp-menu-text-inset,64px)",
    "position:relative",
    "cursor:default",
    "display:flex",
    "align-items:center",
    "gap:0",
  ].join(";");

  button.appendChild(accountsIconSlot());

  const title = document.createElement("span");
  title.textContent = t("accounts.title");
  title.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit;";
  button.appendChild(title);

  const chevronSlot = document.createElement("span");
  chevronSlot.setAttribute("data-accounts-chevron", "");
  chevronSlot.style.cssText =
    `display:flex;align-items:center;justify-content:center;width:${metrics.chevronSlotWidth};height:20px;` +
    `margin-left:auto;margin-right:${metrics.chevronMarginRight};flex:0 0 ${metrics.chevronSlotWidth};` +
    `color:${metrics.chevronColor};opacity:${metrics.chevronOpacity};`;
  chevronSlot.appendChild(cloneUsageRemainingChevron(panel, expanded, metrics));
  button.appendChild(chevronSlot);

  addButtonFeedback(button, {
    normal: { background: "transparent" },
    hover: { background: "color-mix(in srgb,currentColor 8%,transparent)" },
    active: {
      background: "color-mix(in srgb,currentColor 12%,transparent)",
      transform: prefersReducedMotion() ? "" : "scale(0.96)",
    },
  });
  protectInteractiveControl(button);
  bindButtonAction(button, () => toggleAccountsExpanded(panel));
  return button;
}

function toggleAccountsExpanded(panel) {
  panel[ACCOUNTS_COLLAPSIBLE_KEY]?.toggle();
}

function accountsIconSlot() {
  const slot = document.createElement("span");
  slot.setAttribute("aria-hidden", "true");
  slot.style.cssText =
    "position:absolute;left:var(--codexpp-menu-icon-left,24px);top:50%;transform:translateY(-50%);" +
    "display:flex;align-items:center;justify-content:center;height:24px;width:var(--codexpp-menu-icon-slot-width,24px);" +
    "color:var(--color-token-text-secondary,var(--color-token-text-tertiary,currentColor));";
  slot.appendChild(accountsIcon());
  return slot;
}

function accountsIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("data-codexpp-accounts-icon", "");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.style.display = "block";
  svg.style.color = "inherit";

  for (const [tagName, attrs] of [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: "9", cy: "7", r: "4" }],
    ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }],
    ["path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }],
  ]) {
    const child = document.createElementNS("http://www.w3.org/2000/svg", tagName);
    for (const [name, value] of Object.entries(attrs)) {
      child.setAttribute(name, value);
    }
    svg.appendChild(child);
  }

  return svg;
}

/**
 * Clones the chevron SVG from Codex's native "Usage remaining" collapsible
 * so the Accounts section uses the exact same arrow icon with matching style.
 * Falls back to "Rate limits" if "Usage remaining" isn't found, then to a
 * local chevron if neither exists.
 */
function cloneUsageRemainingChevron(panel, expanded, metrics) {
  const reference = findNativeCollapsibleReference(panel);
  const size = metrics?.chevronSize || ACCOUNTS_CHEVRON_SIZE;
  if (reference?.chevron) {
    const clone = reference.chevron.cloneNode(true);
    return prepareChevronSvg(clone, expanded, size);
  }

  return prepareChevronSvg(accountsChevronIcon(), expanded, size);
}

function prepareChevronSvg(svg, expanded, size) {
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("width", size || ACCOUNTS_CHEVRON_SIZE);
  svg.setAttribute("height", size || ACCOUNTS_CHEVRON_SIZE);
  normalizeChevronPaint(svg);
  svg.style.color = "inherit";
  svg.style.display = "block";
  svg.style.flex = "0 0 auto";
  svg.style.visibility = "visible";
  svg.style.transform = accountsChevronTransform(expanded);
  svg.style.transformOrigin = "center";
  svg.style.transition = `transform ${accountsPanelDuration(true)}ms ${ACCOUNTS_PANEL_EASING}`;
  return svg;
}

function normalizeChevronPaint(svg) {
  const painted = [svg, ...svg.querySelectorAll("[stroke], [fill]")];
  for (const element of painted) {
    const stroke = element.getAttribute("stroke");
    if (stroke && stroke !== "none") element.setAttribute("stroke", "currentColor");
    const fill = element.getAttribute("fill");
    if (fill && fill !== "none") element.setAttribute("fill", "currentColor");
    element.style.color = "inherit";
    element.style.opacity = "1";
  }
}

function accountsChevronIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("data-codexpp-accounts-chevron-fallback", "");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "m9 18 6-6-6-6");
  svg.appendChild(path);
  return svg;
}

function nativeCollapsibleMetrics(panel) {
  const fallback = {
    chevronColor: ACCOUNTS_CHEVRON_COLOR,
    chevronOpacity: "1",
    chevronMarginRight: "0px",
    chevronSlotWidth: "20px",
  };
  const reference = findNativeCollapsibleReference(panel);
  if (!reference?.row || typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
    return fallback;
  }

  const rowStyle = window.getComputedStyle(reference.row);
  const chevronStyle = reference.chevron ? window.getComputedStyle(reference.chevron) : null;
  const chevronRect =
    reference.chevron && typeof reference.chevron.getBoundingClientRect === "function"
      ? reference.chevron.getBoundingClientRect()
      : null;
  const rowRect =
    typeof reference.row.getBoundingClientRect === "function" ? reference.row.getBoundingClientRect() : null;
  const paddingRight = parseCssPixels(rowStyle.paddingRight);
  const chevronWidth = chevronRect?.width > 0 ? chevronRect.width : Number.parseFloat(ACCOUNTS_CHEVRON_SIZE);
  const slotWidth = Math.max(20, Math.round(chevronWidth));
  const rightInset = rowRect && chevronRect?.width > 0 ? rowRect.right - chevronRect.right : paddingRight;
  const opticalInset = (slotWidth - chevronWidth) / 2;
  const marginRight = Number.isFinite(rightInset) && Number.isFinite(paddingRight)
    ? Math.round(rightInset - paddingRight - opticalInset)
    : 0;
  const color = ACCOUNTS_CHEVRON_COLOR;
  const opacity = fallback.chevronOpacity;
  const chevronSize = String(Math.round(chevronWidth));

  return {
    chevronColor: color,
    chevronOpacity: opacity,
    chevronMarginRight: `${marginRight}px`,
    chevronSlotWidth: `${slotWidth}px`,
    chevronSize,
  };
}

function findNativeCollapsibleReference(panel) {
  return findNativeCollapsibleRow(panel, /\busage remaining\b/i) || findNativeCollapsibleRow(panel, /\brate limits/i);
}

function findNativeCollapsibleRow(panel, pattern) {
  const menu =
    panel.closest('[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]') ||
    document;
  const row = Array.from(menu.querySelectorAll('button, a, [role="menuitem"]')).find((element) => {
    return element instanceof HTMLElement && pattern.test(element.textContent || "");
  });
  if (!(row instanceof HTMLElement)) return null;
  const icons = Array.from(row.querySelectorAll("svg"));
  const chevron = icons.length ? icons[icons.length - 1] : null;
  return { row, chevron };
}

function parseCssPixels(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function configureAccountsRow(state, panel) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = t("accounts.configure");
  button.style.cssText =
    "box-sizing:border-box;width:100%;border:0;background:transparent;color:var(--color-token-text-secondary,currentColor);" +
    "font:inherit;font-size:13px;line-height:1.25;text-align:left;border-radius:6px;margin:0;" +
    "min-height:32px;padding:0 var(--codexpp-menu-row-padding-right,24px) 0 var(--codexpp-menu-text-inset,64px);cursor:default;";
  addButtonFeedback(button, {
    normal: { background: "transparent" },
    hover: { background: "color-mix(in srgb,currentColor 7%,transparent)" },
    active: {
      background: "color-mix(in srgb,currentColor 10%,transparent)",
      transform: prefersReducedMotion() ? "" : "scale(0.96)",
    },
  });
  protectInteractiveControl(button);
  bindButtonAction(button, () => openAccountsSettings(state, panel));
  return button;
}

function openAccountsSettings(state, panel) {
  const menu =
    panel.closest('[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]') ||
    document;
  const settingsItem = findMenuCommand(menu, /settings/i);
  panel[ACCOUNTS_COLLAPSIBLE_KEY]?.collapse();
  settingsItem?.click();
  window.setTimeout(() => {
    const accountsNav = Array.from(
      document.querySelectorAll('button[data-codexpp^="nav-page-"], button'),
    ).find((element) => {
      return element instanceof HTMLElement && /\baccounts\b/i.test(element.textContent || "");
    });
    if (accountsNav instanceof HTMLElement) accountsNav.click();
  }, 300);
  window.setTimeout(() => {
    if (panel.isConnected) panel.remove();
  }, accountsPanelDuration(false));
}

function findMenuCommand(root, pattern) {
  return Array.from(root.querySelectorAll('button, a, [role="menuitem"]')).find((element) => {
    return element instanceof HTMLElement && pattern.test(element.textContent || "");
  });
}

async function runPanelAction(state, panel, action, payload, loadingText) {
  setPanelStatus(panel, loadingText);
  try {
    const accountState = await invoke(state, action, payload);
    if (action === "switch" || action === "clear-active") {
      setPanelStatus(panel, authReloadMessage(action, accountState));
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

async function refreshPanel(state, panel) {
  setPanelStatus(panel, t("accounts.loading"));
  try {
    const accountState = await invoke(state, "state");
    renderAccountPanel(state, panel, accountState);
    refreshUsageInBackground(state, (freshState) => {
      if (panel.isConnected) renderAccountPanel(state, panel, freshState);
      if (state.settingsRoot?.isConnected) {
        renderAccountsPageState(state, state.settingsRoot, freshState);
      }
    });
  } catch (error) {
    setPanelStatus(panel, errorMessage(error));
  }
}

module.exports = { renderAccountPanel, accountPanelShell, refreshPanel };
