const { protectInteractiveControl } = require("./dom-utils");

const PANEL_ROW_LEFT_INSET = 64;
const MENU_ICON_SLOT_WIDTH = "24px";
const MENU_ICON_TEXT_GAP = "16px";
const MENU_ICON_LEFT = "24px";

function addButtonFeedback(element, styles) {
  const normal = {
    background: element.style.background || element.style.backgroundColor || "transparent",
    color: element.style.color || "",
    transform: element.style.transform || "",
  };
  const apply = (values) => {
    if (values.background != null) element.style.background = values.background;
    if (values.color != null) element.style.color = values.color;
    if (values.transform != null) element.style.transform = values.transform;
  };
  const hover = styles.hover || {};
  const active = styles.active || hover;
  const restore = () => apply(styles.normal || normal);
  element.style.transformOrigin = "center";
  element.style.transition = prefersReducedMotion()
    ? "background-color 120ms ease, color 120ms ease"
    : "background-color 120ms ease, color 120ms ease, transform 120ms cubic-bezier(0.23, 1, 0.32, 1)";
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

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// ─── Popup-panel buttons ──────────────────────────────────────────────────────

function smallButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.cssText =
    "height:24px;border:0;border-radius:6px;padding:0 8px;" +
    "background:color-mix(in srgb,var(--color-token-text-primary,currentColor) 10%,transparent);" +
    "color:var(--color-token-text-primary,currentColor);font:inherit;font-size:12px;line-height:1;cursor:pointer;";
  addButtonFeedback(button, {
    hover: {
      background: "color-mix(in srgb,var(--color-token-text-primary,currentColor) 16%,transparent)",
    },
    active: {
      background: "color-mix(in srgb,var(--color-token-text-primary,currentColor) 22%,transparent)",
      transform: prefersReducedMotion() ? "" : "scale(0.97)",
    },
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
  button.style.cssText =
    "display:grid;place-items:center;width:22px;height:22px;border:0;border-radius:5px;" +
    "background:transparent;color:var(--color-token-text-secondary,currentColor);" +
    "font:inherit;font-size:16px;line-height:1;cursor:pointer;";
  addButtonFeedback(button, {
    hover: {
      background: "color-mix(in srgb,var(--color-token-text-primary,currentColor) 10%,transparent)",
      color: "var(--color-token-text-primary,currentColor)",
    },
    active: {
      background: "color-mix(in srgb,var(--color-token-text-primary,currentColor) 18%,transparent)",
      color: "var(--color-token-text-primary,currentColor)",
      transform: prefersReducedMotion() ? "" : "scale(0.97)",
    },
  });
  protectInteractiveControl(button);
  return button;
}

// ─── Settings-page primitives ─────────────────────────────────────────────────

function settingsButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className =
    "inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-sm " +
    "text-token-text-primary hover:bg-token-foreground/10 disabled:cursor-default disabled:opacity-50";
  button.style.border = "1px solid color-mix(in srgb, currentColor 14%, transparent)";
  button.style.backgroundColor = "color-mix(in srgb, currentColor 5%, transparent)";
  addButtonFeedback(button, {
    hover: {
      background: "color-mix(in srgb, currentColor 10%, transparent)",
    },
    active: {
      background: "color-mix(in srgb, currentColor 16%, transparent)",
      transform: prefersReducedMotion() ? "" : "scale(0.97)",
    },
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
  card.className =
    "border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border";
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
  status.style.color = isError
    ? "var(--color-token-text-error, #c2410c)"
    : "var(--color-token-text-secondary, currentColor)";
  status.textContent = text;
  return status;
}

// ─── Popup-panel shell & status ───────────────────────────────────────────────

function accountPanelShell(base) {
  const panel = document.createElement("div");
  panel.setAttribute("data-codexpp-account-switcher", "panel");
  panel.setAttribute("role", "presentation");
  panel.style.cssText = [
    "box-sizing:border-box",
    "width:100%",
    "margin:0",
    "padding:0",
    "color:var(--color-token-text-primary,currentColor)",
    "cursor:default",
    "user-select:none",
  ].join(";");
  applyNativeMenuMetrics(panel, base);
  return panel;
}

function applyNativeMenuMetrics(panel, base) {
  const metrics = nativeMenuMetrics(base);
  panel.style.setProperty("--codexpp-menu-row-padding-top", metrics.paddingTop);
  panel.style.setProperty("--codexpp-menu-row-padding-right", metrics.paddingRight);
  panel.style.setProperty("--codexpp-menu-row-padding-bottom", metrics.paddingBottom);
  panel.style.setProperty("--codexpp-menu-row-padding-left", metrics.paddingLeft);
  panel.style.setProperty("--codexpp-menu-row-height", metrics.height);
  panel.style.setProperty("--codexpp-menu-row-radius", metrics.borderRadius);
  panel.style.setProperty("--codexpp-menu-icon-left", metrics.iconLeft);
  panel.style.setProperty("--codexpp-menu-icon-slot-width", metrics.iconSlotWidth);
  panel.style.setProperty("--codexpp-menu-icon-gap", metrics.iconGap);
  panel.style.setProperty("--codexpp-menu-text-inset", metrics.textInset);
}

function nativeMenuMetrics(base) {
  const fallback = {
    paddingTop: "0px",
    paddingRight: "24px",
    paddingBottom: "0px",
    paddingLeft: "24px",
    height: "40px",
    borderRadius: "8px",
    iconLeft: MENU_ICON_LEFT,
    iconSlotWidth: MENU_ICON_SLOT_WIDTH,
    iconGap: MENU_ICON_TEXT_GAP,
    textInset: PANEL_ROW_LEFT_INSET + "px",
  };
  if (!base || typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
    return fallback;
  }

  const style = window.getComputedStyle(base);
  const rect = typeof base.getBoundingClientRect === "function" ? base.getBoundingClientRect() : null;
  const iconRect = base.querySelector("svg")?.getBoundingClientRect();
  const textRect = firstTextRect(base);
  return {
    paddingTop: cssLengthOr(style.paddingTop, fallback.paddingTop),
    paddingRight: cssLengthOr(style.paddingRight, fallback.paddingRight),
    paddingBottom: cssLengthOr(style.paddingBottom, fallback.paddingBottom),
    paddingLeft: cssLengthOr(style.paddingLeft, fallback.paddingLeft),
    height: rect?.height > 0 ? `${Math.round(rect.height)}px` : fallback.height,
    borderRadius: cssLengthOr(style.borderRadius, fallback.borderRadius),
    iconLeft: rect && iconRect?.width > 0 ? `${Math.round(iconRect.left - rect.left)}px` : fallback.iconLeft,
    iconSlotWidth: iconRect?.width > 0 ? `${Math.round(iconRect.width)}px` : fallback.iconSlotWidth,
    iconGap: MENU_ICON_TEXT_GAP,
    textInset: rect && textRect?.width > 0 ? `${Math.round(textRect.left - rect.left)}px` : fallback.textInset,
  };
}

function firstTextRect(element) {
  if (typeof document === "undefined" || typeof document.createTreeWalker !== "function") return null;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim()) {
      const parent = node.parentElement;
      if (!parent?.closest("svg")) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = Array.from(range.getClientRects()).find((item) => item.width > 0 && item.height > 0);
        range.detach?.();
        if (rect) return rect;
      }
    }
    node = walker.nextNode();
  }
  return null;
}

function cssLengthOr(value, fallback) {
  return value && value !== "normal" && value !== "auto" && value !== "0px" ? value : fallback;
}

function setPanelStatus(panel, text) {
  panel.textContent = "";
  const status = document.createElement("div");
  status.textContent = text;
  status.style.cssText =
    `font-size:12px;line-height:1.35;color:var(--color-token-text-secondary,currentColor);` +
    "padding:4px var(--codexpp-menu-row-padding-right,24px) 6px var(--codexpp-menu-text-inset,64px);";
  panel.appendChild(status);
}

function accountDisplayName(accountState, name, options = {}) {
  const email = accountState?.accountEmails?.[name];
  const suffix = accountState?.current === name && options.includeCurrent !== false ? " (current)" : "";
  return email ? `${email}${suffix}` : `${name}${suffix}`;
}

function accountUsageSummary(accountState, name) {
  const parts = accountUsageParts(accountState, name).map(usageWindowSummary);
  if (!parts.length) return null;
  return parts.join(" · ");
}

function accountUsageTitle(accountState, name) {
  const parts = accountUsageParts(accountState, name).filter((part) => part.projected);
  if (!parts.length) return "";
  const labels = parts.map((part) => part.label).join(", ");
  return `${labels} reset time has elapsed. Displayed remaining is calculated from the cached reset schedule and updates live when this account is active.`;
}

function accountUsageParts(accountState, name) {
  const usage = accountState?.accountUsage?.[name];
  if (!usage || typeof usage !== "object") return [];
  return [
    usageWindowPart(usage.fiveHour, "5h"),
    usageWindowPart(usage.weekly, "Weekly"),
  ].filter(Boolean);
}

function usageWindowPart(window, fallbackLabel) {
  if (typeof window?.pct !== "number") return null;
  const label = window.label || fallbackLabel;
  const exhausted = window.pct <= 0;
  const resetAtMs = Number(window.resetAtMs);
  const hasResetAtMs = Number.isFinite(resetAtMs) && resetAtMs > 0;
  const resetPassed = hasResetAtMs && resetAtMs <= Date.now();
  const part = {
    label,
    pct: window.pct,
    resetAt: typeof window.resetAt === "string" && window.resetAt ? window.resetAt : null,
    exhausted,
    resetPassed,
  };
  if (hasResetAtMs) part.resetAtMs = resetAtMs;
  if (window.projected === true) part.projected = true;
  return part;
}

function usageWindowSummary(part) {
  const reset = part.projected
    ? " (reset elapsed)"
    : part.exhausted && part.resetAt
      ? `, resets ${part.resetAt}`
      : "";
  return `${part.label} ${part.pct}%${reset}`;
}

module.exports = {
  PANEL_ROW_LEFT_INSET,
  addButtonFeedback,
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
  accountDisplayName,
  accountUsageParts,
  accountUsageSummary,
  accountUsageTitle,
  prefersReducedMotion,
};
