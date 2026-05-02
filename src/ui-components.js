const { protectInteractiveControl, compactText } = require("./dom-utils");

// ─── Popup-panel buttons ──────────────────────────────────────────────────────

function smallButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.cssText =
    "height:24px;border:0;border-radius:6px;padding:0 8px;" +
    "background:color-mix(in srgb,var(--color-token-text-primary,currentColor) 10%,transparent);" +
    "color:var(--color-token-text-primary,currentColor);font:inherit;font-size:12px;line-height:1;cursor:pointer;";
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
  button.addEventListener("click", onClick);
  row.appendChild(button);
  return row;
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
  panel.style.cssText = [
    "box-sizing:border-box",
    "width:calc(100% - 16px)",
    "margin:4px 8px 8px",
    "padding:10px",
    "border-top:1px solid var(--color-token-border-default,rgba(255,255,255,.12))",
    "border-bottom:1px solid var(--color-token-border-default,rgba(255,255,255,.12))",
    "color:var(--color-token-text-primary,currentColor)",
    "cursor:default",
    "user-select:none",
  ].join(";");
  if (base?.className) panel.className = base.className;
  return panel;
}

function setPanelStatus(panel, text) {
  panel.textContent = "";
  const status = document.createElement("div");
  status.textContent = text;
  status.style.cssText =
    "font-size:12px;color:var(--color-token-text-secondary,currentColor);padding:2px 0;";
  panel.appendChild(status);
}

/**
 * Tries to guess an account name from the email shown in the surrounding menu.
 * @param {HTMLElement} panel
 */
function suggestedAccountName(panel) {
  const menu =
    panel.closest('[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]') ||
    panel.parentElement;
  const text = compactText(menu);
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (match) return match[0].split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "-");
  return "";
}

module.exports = {
  smallButton,
  iconButton,
  settingsButton,
  settingsSection,
  settingsCard,
  settingsRowShell,
  settingsInfoRow,
  settingsActionRow,
  settingsStatus,
  accountPanelShell,
  setPanelStatus,
  suggestedAccountName,
};
