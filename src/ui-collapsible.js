const { prefersReducedMotion } = require("./ui-components");

const ACCOUNTS_PANEL_TRANSITION_MS = 300;
const ACCOUNTS_PANEL_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
const ACCOUNTS_CHEVRON_COLLAPSED = "rotate(0deg)";
const ACCOUNTS_CHEVRON_EXPANDED = "rotate(90deg)";
const ACCOUNTS_BODY_COLLAPSED_TRANSFORM = "translateY(-2px)";
const ACCOUNTS_BODY_EXPANDED_TRANSFORM = "translateY(0)";

function accountsPanelDuration() {
  if (prefersReducedMotion()) return 0;
  return ACCOUNTS_PANEL_TRANSITION_MS;
}

function accountsBodyTransition(duration) {
  return `max-height ${duration}ms ${ACCOUNTS_PANEL_EASING},opacity ${duration}ms ${ACCOUNTS_PANEL_EASING},transform ${duration}ms ${ACCOUNTS_PANEL_EASING}`;
}

function accountsChevronTransform(expanded) {
  return expanded ? ACCOUNTS_CHEVRON_EXPANDED : ACCOUNTS_CHEVRON_COLLAPSED;
}

function accountsBodyCss(expanded) {
  return [
    "overflow:hidden",
    "max-height:0",
    "opacity:0",
    `transform:${expanded ? ACCOUNTS_BODY_EXPANDED_TRANSFORM : ACCOUNTS_BODY_COLLAPSED_TRANSFORM}`,
    `pointer-events:${expanded ? "auto" : "none"}`,
    `transition:${expanded ? "none" : accountsBodyTransition(ACCOUNTS_PANEL_TRANSITION_MS)}`,
  ].join(";");
}

function createAccountsCollapsible(state, elements, expanded) {
  applyAccountsExpanded(state, elements, expanded, { animate: false });

  if (expanded && typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      if (elements.body.isConnected) {
        elements.body.style.transition = accountsBodyTransition(accountsPanelDuration());
      }
    });
  }

  return {
    toggle() {
      applyAccountsExpanded(state, elements, !state.accountsExpanded, { animate: true });
    },
    collapse() {
      applyAccountsExpanded(state, elements, false, { animate: true });
    },
  };
}

function applyAccountsExpanded(state, elements, expanded, options) {
  state.accountsExpanded = expanded;
  const duration = options.animate ? accountsPanelDuration() : 0;
  if (options.animate) {
    elements.body.style.transition = accountsBodyTransition(duration);
  }
  elements.body.style.pointerEvents = expanded ? "auto" : "none";
  elements.body.style.maxHeight = expanded ? elements.body.scrollHeight + "px" : "0";
  elements.body.style.opacity = expanded ? "1" : "0";
  elements.body.style.transform = expanded
    ? ACCOUNTS_BODY_EXPANDED_TRANSFORM
    : ACCOUNTS_BODY_COLLAPSED_TRANSFORM;
  elements.header.setAttribute("aria-expanded", String(expanded));
  if (elements.chevron) {
    elements.chevron.style.transitionDuration = duration + "ms";
    elements.chevron.style.transform = accountsChevronTransform(expanded);
  }
  for (const note of elements.notes) {
    note.style.display = expanded ? "block" : "none";
  }
}

module.exports = {
  ACCOUNTS_PANEL_EASING,
  ACCOUNTS_PANEL_TRANSITION_MS,
  accountsBodyCss,
  accountsBodyTransition,
  accountsChevronTransform,
  accountsPanelDuration,
  createAccountsCollapsible,
};
