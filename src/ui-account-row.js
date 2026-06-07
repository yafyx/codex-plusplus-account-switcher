const {
  accountDisplayName,
  accountUsageParts,
  accountUsageTitle,
  addButtonFeedback,
  bindButtonAction,
} = require("./ui-components");
const { protectInteractiveControl } = require("./dom-utils");

const ACCOUNT_CURRENT_BACKGROUND = "color-mix(in srgb,currentColor 5%,transparent)";
const ACCOUNT_CURRENT_SHADOW = "inset 0 0 0 1px color-mix(in srgb,currentColor 7%,transparent)";

function accountRow(accountState, name, onSwitch) {
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
    onSwitch(name);
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
  if (part.label === "Weekly" && part.resetAt) {
    return { label: part.label, value, meta: formatWeeklyResetDate(part) };
  }
  return { label: part.label, value, meta: "" };
}

function formatWeeklyResetDate(part) {
  const resetAtMs = Number(part.resetAtMs);
  if (Number.isFinite(resetAtMs) && resetAtMs > 0) {
    const date = new Date(resetAtMs);
    if (Number.isFinite(date.getTime())) {
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
  }
  return stripWeeklyResetTime(part.resetAt);
}

function stripWeeklyResetTime(resetAt) {
  if (typeof resetAt !== "string") return "";
  const dateMatch = /\b([A-Z][a-z]{2,8})\s+(\d{1,2})\b/.exec(resetAt);
  if (dateMatch) return `${dateMatch[1]} ${dateMatch[2]}`;
  return resetAt.replace(/^[A-Z][a-z]{2},\s*/i, "").replace(/\s+\d{1,2}:\d{2}\s*(?:AM|PM)?$/i, "").trim();
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

module.exports = { accountRow };
