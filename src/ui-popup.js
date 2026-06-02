const { errorMessage } = require("./utils");
const { invoke } = require("./ipc");
const { t } = require("./i18n");
const { protectInteractiveControl } = require("./dom-utils");
const { renderAccountsPageState } = require("./ui-settings");
const {
  accountPanelShell,
  setPanelStatus,
  accountDisplayName,
  accountUsageParts,
  accountUsageTitle,
  addButtonFeedback,
  bindButtonAction,
  prefersReducedMotion,
} = require("./ui-components");

const ACCOUNTS_PANEL_TRANSITION_MS = 300;
// Strong ease-out (Emil Kowalski recommendation): starts fast, settles naturally.
// Matches the feel Codex uses for its own "Usage remaining" collapsible.
const ACCOUNTS_PANEL_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
const ACCOUNTS_CHEVRON_COLLAPSED = "rotate(0deg)";
const ACCOUNTS_CHEVRON_EXPANDED = "rotate(90deg)";
const ACCOUNTS_CHEVRON_SIZE = "16";
const ACCOUNTS_CHEVRON_COLOR = "#5C5B56";
const ACCOUNTS_BODY_COLLAPSED_TRANSFORM = "translateY(-2px)";
const ACCOUNTS_BODY_EXPANDED_TRANSFORM = "translateY(0)";
const ACCOUNT_CURRENT_BACKGROUND = "color-mix(in srgb,currentColor 5%,transparent)";
const ACCOUNT_CURRENT_SHADOW = "inset 0 0 0 1px color-mix(in srgb,currentColor 7%,transparent)";

// ─── Panel render ─────────────────────────────────────────────────────────────

function renderAccountPanel(state, panel, accountState) {
  panel.textContent = "";
  panel.setAttribute("data-codexpp-account-switcher", "panel");

  const accounts = Array.isArray(accountState.accounts) ? accountState.accounts : [];
  const expanded = state.accountsExpanded === true;

  const section = document.createElement("div");
  section.style.cssText = "display:flex;flex-direction:column;padding:0;";
  section.appendChild(accountsHeaderRow(state, panel, accountState, expanded));

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
    list.appendChild(accountRow(state, panel, accountState, name));
  }

  list.appendChild(configureAccountsRow(state, panel));
  const body = document.createElement("div");
  body.setAttribute("data-codexpp-account-switcher-body", "accounts");
  const bodyTransition = accountsBodyTransition(ACCOUNTS_PANEL_TRANSITION_MS);
  body.style.cssText = [
    "overflow:hidden",
    "max-height:0",
    "opacity:0",
    `transform:${expanded ? ACCOUNTS_BODY_EXPANDED_TRANSFORM : ACCOUNTS_BODY_COLLAPSED_TRANSFORM}`,
    `pointer-events:${expanded ? "auto" : "none"}`,
    `transition:${expanded ? "none" : bodyTransition}`,
  ].join(";");
  const bodyInner = document.createElement("div");
  bodyInner.style.cssText = "min-height:0;";
  bodyInner.appendChild(list);
  body.appendChild(bodyInner);
  section.appendChild(body);
  panel.appendChild(section);
  if (expanded) {
    // Preserve the expanded state when reopening the menu without replaying a
    // dropdown animation every time the account popover appears.
    body.style.maxHeight = body.scrollHeight + "px";
    body.style.opacity = "1";
    body.style.transform = ACCOUNTS_BODY_EXPANDED_TRANSFORM;
    body.style.pointerEvents = "auto";
    window.requestAnimationFrame(() => {
      if (body.isConnected) body.style.transition = bodyTransition;
    });
  }

  // Notice / error
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
    panel.appendChild(note);
  }
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
  bindButtonAction(button, () => toggleAccountsExpanded(state, panel, accountState, expanded));
  return button;
}

function toggleAccountsExpanded(state, panel, accountState, _ignored) {
  const body = panel.querySelector("[data-codexpp-account-switcher-body]");
  if (!body) return;
  const currentlyExpanded = state.accountsExpanded;
  state.accountsExpanded = !currentlyExpanded;
  const newExpanded = !currentlyExpanded;
  // Measure actual content height so the max-height animation matches
  // exactly — no hardcoded value, no jarring snap at the end.
  const duration = accountsPanelDuration(newExpanded);
  body.style.transition = accountsBodyTransition(duration);
  body.style.pointerEvents = newExpanded ? "auto" : "none";
  body.style.maxHeight = newExpanded ? body.scrollHeight + "px" : "0";
  body.style.opacity = newExpanded ? "1" : "0";
  body.style.transform = newExpanded ? ACCOUNTS_BODY_EXPANDED_TRANSFORM : ACCOUNTS_BODY_COLLAPSED_TRANSFORM;
  const header = panel.querySelector("button[aria-expanded]");
  if (header) header.setAttribute("aria-expanded", String(newExpanded));
  const chevron = panel.querySelector("[data-accounts-chevron] svg");
  if (chevron instanceof SVGElement) {
    chevron.style.transitionDuration = duration + "ms";
    chevron.style.transform = accountsChevronTransform(newExpanded);
  }
  const notes = panel.querySelectorAll("[data-codexpp-account-switcher-notice]");
  for (const note of notes) {
    if (note instanceof HTMLElement) {
      note.style.display = newExpanded ? "block" : "none";
    }
  }
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

function accountsChevronTransform(expanded) {
  return expanded ? ACCOUNTS_CHEVRON_EXPANDED : ACCOUNTS_CHEVRON_COLLAPSED;
}

function accountsPanelDuration() {
  if (prefersReducedMotion()) return 0;
  return ACCOUNTS_PANEL_TRANSITION_MS;
}

function accountsBodyTransition(duration) {
  return `max-height ${duration}ms ${ACCOUNTS_PANEL_EASING},opacity ${duration}ms ${ACCOUNTS_PANEL_EASING},transform ${duration}ms ${ACCOUNTS_PANEL_EASING}`;
}

// ─── Per-account row ──────────────────────────────────────────────────────────

function accountRow(state, panel, accountState, name) {
  const row = document.createElement("button");
  row.type = "button";
  row.title = accountDisplayName(accountState, name, { includeCurrent: false });
  const isCurrent = accountState.current === name;
  if (isCurrent) {
    row.setAttribute("aria-current", "true");
    row.setAttribute("data-codexpp-account-current", "true");
  }
  const normalBackground = isCurrent ? ACCOUNT_CURRENT_BACKGROUND : "transparent";
  const normalShadow = isCurrent ? ACCOUNT_CURRENT_SHADOW : "none";
  row.style.cssText =
    "box-sizing:border-box;width:100%;min-height:44px;border:0;text-align:left;font:inherit;" +
    "display:flex;flex-direction:column;justify-content:center;gap:0;" +
    `border-radius:var(--codexpp-menu-row-radius,8px);margin:0;padding:2px var(--codexpp-menu-row-padding-right,24px) 2px var(--codexpp-menu-text-inset,64px);background:${normalBackground};` +
    `box-shadow:${normalShadow};` +
    "color:var(--color-token-text-primary,currentColor);cursor:default;";
  const titleRow = document.createElement("span");
  titleRow.style.cssText =
    "display:grid;grid-template-columns:minmax(0,1fr) auto;min-width:0;width:100%;align-items:baseline;column-gap:12px;" +
    "min-height:20px;";
  const nameText = document.createElement("span");
  nameText.textContent = accountDisplayName(accountState, name, { includeCurrent: false });
  nameText.style.cssText =
    "display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:1.3;" +
    `font-weight:${isCurrent ? "500" : "400"};`;
  titleRow.appendChild(nameText);
  const planText = accountPlanText(accountState?.accountPlans?.[name]);
  if (planText) titleRow.appendChild(planText);
  row.appendChild(titleRow);
  const usage = accountUsageParts(accountState, name);
  const details = accountDetailsLine(accountState, name, usage);
  if (details) row.appendChild(details);
  addButtonFeedback(row, {
    normal: { background: normalBackground },
    hover: {
      background: "var(--color-token-list-hover-background, color-mix(in srgb,currentColor 8%,transparent))",
    },
    active: {
      background: "color-mix(in srgb,currentColor 12%,transparent)",
      transform: "",
    },
  });
  protectInteractiveControl(row);
  bindButtonAction(row, () => {
    if (accountState.current === name) return;
    void runPanelAction(state, panel, "switch", { name }, t("accounts.switching"));
  });
  return row;
}

function accountPlanText(plan) {
  const label = accountPlanLabel(plan);
  if (!label) return null;
  const paid = isPaidAccountPlan(plan);
  const accent = "var(--color-token-charts-blue,var(--color-token-text-link-foreground,#0285ff))";
  const text = document.createElement("span");
  text.setAttribute("data-codexpp-account-plan", "");
  text.setAttribute("data-codexpp-account-plan-tone", paid ? "paid" : "free");
  text.setAttribute("aria-label", `ChatGPT ${label} plan`);
  text.title = `ChatGPT ${label} plan`;
  text.textContent = label;
  text.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "flex:0 0 auto",
    "max-width:96px",
    "min-width:0",
    "overflow:hidden",
    "text-overflow:ellipsis",
    "border-radius:999px",
    "padding:1px 6px",
    paid
      ? `background:color-mix(in srgb,${accent} 14%,transparent)`
      : "background:color-mix(in srgb,currentColor 5%,transparent)",
    paid
      ? `box-shadow:inset 0 0 0 1px color-mix(in srgb,${accent} 32%,transparent)`
      : "box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 7%,transparent)",
    paid ? `color:${accent}` : "color:var(--color-token-text-tertiary,var(--color-token-text-secondary,currentColor))",
    "font-size:11px",
    "font-weight:500",
    "letter-spacing:0",
    "line-height:1.35",
    "text-align:right",
    "white-space:nowrap",
  ].join(";");
  return text;
}

function formatAccountPlanLabel(plan) {
  return plan
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function accountDetailsLine(accountState, name, usage) {
  const fragments = usage.map(accountUsageFragment);
  if (!fragments.length) return null;

  const line = document.createElement("span");
  line.setAttribute("data-codexpp-account-usage", "");
  line.setAttribute("data-codexpp-account-details", "");
  const title = accountUsageTitle(accountState, name);
  if (title) line.title = title;
  line.style.cssText = [
    "display:grid",
    "grid-template-columns:minmax(0,1fr) auto",
    "align-items:baseline",
    "column-gap:10px",
    "width:100%",
    "min-width:0",
    "color:var(--color-token-text-secondary,currentColor)",
    "font-size:12px",
    "line-height:1.3",
    "font-variant-numeric:tabular-nums",
  ].join(";");
  line.appendChild(accountDetailsPart(fragments[0], "left"));
  if (fragments.length > 1) {
    line.appendChild(accountDetailsPart(fragments[1], "right"));
  }
  return line;
}

function accountPlanLabel(plan) {
  if (typeof plan !== "string" || !plan.trim()) return "";
  return formatAccountPlanLabel(plan);
}

function isPaidAccountPlan(plan) {
  return typeof plan === "string" && !/^free$/i.test(plan.trim());
}

function accountUsageFragment(part) {
  const value = `${part.pct}%`;
  if (part.projected) {
    return { label: part.label, value, meta: "reset" };
  }
  if (part.exhausted && part.resetAt) {
    return { label: part.label, value, meta: `resets ${part.resetAt}` };
  }
  return { label: part.label, value, meta: "" };
}

function accountDetailsPart(fragment, side) {
  const part = document.createElement("span");
  part.setAttribute(
    "aria-label",
    [fragment.label, fragment.value, fragment.meta].filter(Boolean).join(" "),
  );
  part.style.cssText = [
    "display:inline-flex",
    "align-items:baseline",
    "gap:4px",
    "min-width:0",
    "overflow:hidden",
    "text-overflow:ellipsis",
    "white-space:nowrap",
    "font-variant-numeric:tabular-nums",
    side === "right" ? "text-align:right" : "text-align:left",
    side === "right" ? "justify-content:flex-end" : "justify-content:flex-start",
    side === "right" ? "color:var(--color-token-text-tertiary,var(--color-token-text-secondary,currentColor))" : "",
  ].filter(Boolean).join(";");
  part.appendChild(accountUsageText(fragment.label, [
    "color:var(--color-token-text-tertiary,var(--color-token-text-secondary,currentColor))",
    "font-size:11px",
    "font-weight:400",
    "line-height:1.3",
  ]));
  part.appendChild(accountUsageText(fragment.value, [
    "color:var(--color-token-text-primary,currentColor)",
    "font-size:12px",
    "font-weight:500",
    "line-height:1.3",
  ]));
  if (fragment.meta) {
    part.appendChild(accountUsageText(fragment.meta, [
      "min-width:0",
      "overflow:hidden",
      "text-overflow:ellipsis",
      "color:var(--color-token-text-tertiary,var(--color-token-text-secondary,currentColor))",
      "font-size:11px",
      "font-weight:400",
      "line-height:1.3",
    ]));
  }
  return part;
}

function accountUsageText(text, styles) {
  const element = document.createElement("span");
  element.textContent = text;
  element.style.cssText = styles.join(";");
  return element;
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
  settingsItem?.click();
  window.setTimeout(() => {
    const accountsNav = Array.from(
      document.querySelectorAll('button[data-codexpp^="nav-page-"], button'),
    ).find((element) => {
      return element instanceof HTMLElement && /\baccounts\b/i.test(element.textContent || "");
    });
    if (accountsNav instanceof HTMLElement) accountsNav.click();
  }, 300);
  panel.remove();
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

function authReloadMessage(action, accountState) {
  if (action === "clear-active") {
    return t("accounts.sessionClearedRelaunching");
  }
  const email = accountState.current
    ? accountDisplayName(accountState, accountState.current, { includeCurrent: false })
    : t("accounts.selected");
  return t("accounts.switchedRelaunching", { email });
}

async function refreshPanel(state, panel) {
  setPanelStatus(panel, t("accounts.loading"));
  try {
    const accountState = await invoke(state, "state");
    renderAccountPanel(state, panel, accountState);
    refreshUsageInBackground(state, panel);
  } catch (error) {
    setPanelStatus(panel, errorMessage(error));
  }
}

function refreshUsageInBackground(state, panel) {
  const now = Date.now();
  if (state.usageRefreshInFlight || now - (state.lastUsageRefreshAt || 0) < 60_000) return;
  state.usageRefreshInFlight = true;
  state.lastUsageRefreshAt = now;
  invoke(state, "refresh-usage")
    .then((accountState) => {
      if (panel.isConnected) renderAccountPanel(state, panel, accountState);
      if (state.settingsRoot?.isConnected) {
        renderAccountsPageState(state, state.settingsRoot, accountState);
      }
    })
    .catch((error) => {
      state.api.log.warn("[account-switcher] usage refresh failed", errorMessage(error));
    })
    .finally(() => {
      state.usageRefreshInFlight = false;
  });
}

module.exports = { renderAccountPanel, accountPanelShell, refreshPanel };
