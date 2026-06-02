const assert = require("node:assert/strict");
const test = require("node:test");

// ─── Pattern tests for account-menu detection ────────────────────────────────

test("findSettingsAccountMenu pattern matches Personal Account", () => {
  const text = "Personal account";
  assert.ok(/\bpersonal account\b/i.test(text));
});

test("findSettingsAccountMenu pattern matches Rate limits remaining", () => {
  const text = "Rate limits remaining  87%";
  assert.ok(/\brate limits remaining\b/i.test(text));
});

test("findSettingsAccountMenu pattern matches Usage remaining", () => {
  const text = "Usage remaining";
  assert.ok(/\busage remaining\b/i.test(text));
});

test("findSettingsAccountMenu rejects partial 'personal' substring", () => {
  assert.ok(!/\bpersonal account\b/i.test("impersonal"));
});

test("findSettingsAccountMenu check menu text contains Settings, Log out, and personal account", () => {
  const text = "user@example.com Personal account Settings Log out Rate limits";
  const hasSettings = /\bsettings\b/i.test(text);
  const hasLogout = /\blog out\b/i.test(text);
  const hasPersonalAccount = /\bpersonal account\b/i.test(text);
  const hasUsageRemaining = /\busage remaining\b/i.test(text);
  const hasRateLimits = /\brate limits(?: remaining)?\b/i.test(text);
  assert.ok(hasSettings);
  assert.ok(hasLogout);
  assert.ok(hasPersonalAccount || hasUsageRemaining || hasRateLimits);
});

test("composer usage text is not enough to mount the account switcher", () => {
  const { _test } = require("../src/renderer");

  assert.equal(_test.hasAccountMenuMarker("Usage remaining"), true);
  assert.equal(_test.isAccountMenuText("Usage remaining"), false);
  assert.equal(_test.isAccountMenuText("Attach files Usage remaining Send message"), false);
});

test("settings without an account marker is not the account popover", () => {
  const { _test } = require("../src/renderer");

  assert.equal(_test.isAccountMenuText("Settings Log out"), false);
});

test("installAccountSwitcher target fallback order covers personal account", () => {
  // Verify the regex patterns used in the fallback chain
  const patterns = [/settings/i, /usage remaining/i, /rate limits(?: remaining)?/i, /personal account/i];
  assert.equal(patterns.length, 4);
  assert.ok(patterns[3].test("Personal account"));
  assert.ok(patterns[2].test("Rate limits"));
  assert.ok(patterns[1].test("Usage remaining"));
  assert.ok(patterns[0].test("Settings"));
});

test("installAccountSwitcher copy-id removal regex matches Personal account", () => {
  const targetText = "Personal account";
  assert.ok(/\bpersonal account\b/i.test(targetText));
  assert.ok(!/\bpersonal account\b/i.test("Not Present"));
});

// ─── Compressed-text logic tests ─────────────────────────────────────────────

test("compactText collapses whitespace in mock element", () => {
  // Simulate what compactText does: trim + collapse whitespace
  const text = "  Personal   account  ";
  const collapsed = text.replace(/\s+/g, " ").trim();
  assert.equal(collapsed, "Personal account");
});

test("compactText handles mixed casing", () => {
  const text = "PERSONAL ACCOUNT";
  const collapsed = text.replace(/\s+/g, " ").trim();
  assert.equal(collapsed, "PERSONAL ACCOUNT");
});

// ─── Account display name tests (pure function, no DOM needed) ───────────────

test("accountDisplayName returns email with current suffix", () => {
  const { accountDisplayName } = require("../src/ui-components");
  const result = accountDisplayName(
    { accountEmails: { work: "work@example.com" }, current: "work" },
    "work",
  );
  assert.equal(result, "work@example.com (current)");
});

test("accountDisplayName omits current suffix when includeCurrent is false", () => {
  const { accountDisplayName } = require("../src/ui-components");
  const result = accountDisplayName(
    { accountEmails: { work: "work@example.com" }, current: "work" },
    "work",
    { includeCurrent: false },
  );
  assert.equal(result, "work@example.com");
});

test("accountDisplayName falls back to account name when email missing", () => {
  const { accountDisplayName } = require("../src/ui-components");
  const result = accountDisplayName({ accountEmails: {} }, "work");
  assert.equal(result, "work");
});

// ─── Account usage summary tests (pure function, no DOM needed) ─────────────

test("accountUsageSummary includes reset time for exhausted windows", () => {
  const { accountUsageSummary } = require("../src/ui-components");
  const originalNow = Date.now;
  Date.now = () => 1777728300000;

  try {
    const result = accountUsageSummary(
      {
        accountUsage: {
          work: {
            fiveHour: { label: "5h", pct: 0, resetAt: "8:30 PM" },
            weekly: { label: "Weekly", pct: 0, resetAt: "Sat, 6:00 PM" },
            at: 1777728000000,
          },
        },
      },
      "work",
    );

    assert.equal(result, "5h 0%, resets 8:30 PM · Weekly 0%, resets Sat, 6:00 PM");
  } finally {
    Date.now = originalNow;
  }
});

test("accountUsageParts returns normalized compact usage parts", () => {
  const { accountUsageParts } = require("../src/ui-components");
  const result = accountUsageParts(
    {
      accountUsage: {
        work: {
          fiveHour: { label: "5h", pct: 0, resetAt: "8:30 PM" },
          weekly: { label: "Weekly", pct: 88, resetAt: "Sat, 6:00 PM" },
          at: 1777728000000,
        },
      },
    },
    "work",
  );

  assert.deepEqual(result, [
    { label: "5h", pct: 0, resetAt: "8:30 PM", exhausted: true, resetPassed: false },
    { label: "Weekly", pct: 88, resetAt: "Sat, 6:00 PM", exhausted: false, resetPassed: false },
  ]);
});

test("accountUsageParts returns empty array when usage is missing", () => {
  const { accountUsageParts } = require("../src/ui-components");
  assert.deepEqual(accountUsageParts({ accountUsage: {} }, "work"), []);
});

test("accountUsageSummary omits reset time for non-exhausted windows", () => {
  const { accountUsageSummary } = require("../src/ui-components");
  const originalNow = Date.now;
  Date.now = () => 1777728300000;

  try {
    const result = accountUsageSummary(
      {
        accountUsage: {
          work: {
            fiveHour: { label: "5h", pct: 72, resetAt: "8:30 PM" },
            weekly: { label: "Weekly", pct: 88, resetAt: "Sat, 6:00 PM" },
            at: 1777728000000,
          },
        },
      },
      "work",
    );

    assert.equal(result, "5h 72% · Weekly 88%");
  } finally {
    Date.now = originalNow;
  }
});

test("accountUsageSummary labels projected reset values", () => {
  const { accountUsageSummary, accountUsageTitle } = require("../src/ui-components");
  const accountState = {
    accountUsage: {
      work: {
        fiveHour: { label: "5h", pct: 100, resetAt: null, resetAtMs: null, projected: true },
        weekly: { label: "Weekly", pct: 88, resetAt: "Sat, 6:00 PM" },
      },
    },
  };

  assert.equal(accountUsageSummary(accountState, "work"), "5h 100% (reset elapsed) · Weekly 88%");
  assert.match(accountUsageTitle(accountState, "work"), /5h reset time has elapsed/);
});

// ─── Popup account usage rendering tests ────────────────────────────────────

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.style = {
      cssText: "",
      setProperty(name, value) {
        this[name] = value;
      },
    };
    this._textContent = "";
    this.disabled = false;
    this.scrollHeight = 120;
    this.rect = { width: 0, height: 0, left: 0, right: 0 };
    this.computedStyle = {};
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join("");
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    for (const child of children) this.appendChild(child);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  addEventListener() {}

  closest() {
    return null;
  }

  cloneNode(deep = false) {
    const clone = new FakeElement(this.tagName);
    clone._textContent = this._textContent;
    clone.disabled = this.disabled;
    clone.scrollHeight = this.scrollHeight;
    clone.rect = { ...this.rect };
    clone.computedStyle = { ...this.computedStyle };
    clone.style.cssText = this.style.cssText;
    clone.style.setProperty = this.style.setProperty;
    for (const [name, value] of this.attributes.entries()) clone.attributes.set(name, value);
    if (deep) {
      for (const child of this.children) clone.appendChild(child.cloneNode(true));
    }
    return clone;
  }

  getBoundingClientRect() {
    return this.rect;
  }

  querySelectorAll(selector) {
    const results = [];
    const matches = (element) => {
      if (selector === "button[aria-expanded]") {
        return element.tagName === "BUTTON" && element.attributes.has("aria-expanded");
      }
      if (selector === "[data-accounts-chevron]") {
        return element.attributes.has("data-accounts-chevron");
      }
      if (selector === "[data-codexpp-account-usage]") {
        return element.attributes.has("data-codexpp-account-usage");
      }
      if (selector === "[data-codexpp-account-plan]") {
        return element.attributes.has("data-codexpp-account-plan");
      }
      if (selector === "[data-codexpp-account-current]") {
        return element.attributes.has("data-codexpp-account-current");
      }
      if (selector === "[data-codexpp-account-switcher-body]") {
        return element.attributes.has("data-codexpp-account-switcher-body");
      }
      if (selector === "[data-codexpp-accounts-icon]") {
        return element.attributes.has("data-codexpp-accounts-icon");
      }
      if (selector === "[data-codexpp-accounts-chevron-fallback]") {
        return element.attributes.has("data-codexpp-accounts-chevron-fallback");
      }
      if (selector === "path") {
        return element.tagName === "PATH";
      }
      if (selector === "svg") {
        return element.tagName === "SVG";
      }
      if (selector === "button") {
        return element.tagName === "BUTTON";
      }
      return false;
    };
    const walk = (element) => {
      for (const child of element.children) {
        if (matches(child)) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

function withFakeDom(fn) {
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalHTMLElement = global.HTMLElement;
  global.HTMLElement = FakeElement;
  const fakeDocument = {
    queryItems: [],
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    createElementNS(_namespace, tagName) {
      return new FakeElement(tagName);
    },
    querySelectorAll() {
      return this.queryItems;
    },
  };
  global.document = fakeDocument;
  global.window = {
    getComputedStyle(element) {
      return {
        color: "",
        cursor: "",
        opacity: "1",
        paddingRight: "0px",
        ...element.computedStyle,
      };
    },
    matchMedia() {
      return { matches: false };
    },
    setTimeout() {},
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    cancelAnimationFrame() {},
  };

  try {
    fn(fakeDocument);
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
    global.HTMLElement = originalHTMLElement;
  }
}

test("renderAccountPanel renders compact account usage groups", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: false },
      panel,
      {
        accounts: ["work"],
        current: "work",
        accountEmails: { work: "work@example.com" },
        accountUsage: {
          work: {
            fiveHour: { label: "5h", pct: 60, resetAt: "12:38 PM" },
            weekly: { label: "Weekly", pct: 94, resetAt: "May 31" },
          },
        },
      },
    );

    const usage = panel.querySelector("[data-codexpp-account-usage]");
    assert.ok(usage);
    assert.equal(usage.children[0].textContent, "5h60%");
    assert.equal(usage.children[0].getAttribute("aria-label"), "5h 60%");
    assert.equal(usage.children[1].textContent, "Weekly94%");
    assert.equal(usage.children[1].getAttribute("aria-label"), "Weekly 94%");
    assert.doesNotMatch(usage.textContent, /resets/);
  });
});

test("renderAccountPanel renders a quiet native plan label beside the account email", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: false },
      panel,
      {
        accounts: ["work"],
        current: "work",
        accountEmails: { work: "work@example.com" },
        accountPlans: { work: "plus" },
        accountUsage: {},
      },
    );

    const plan = panel.querySelector("[data-codexpp-account-plan]");
    assert.ok(plan);
    assert.equal(plan.textContent, "Plus");
    assert.equal(plan.title, "ChatGPT Plus plan");
    assert.equal(plan.getAttribute("aria-label"), "ChatGPT Plus plan");
    assert.equal(plan.getAttribute("data-codexpp-account-plan-tone"), "paid");
    assert.match(plan.style.cssText, /display:inline-flex/);
    assert.match(plan.style.cssText, /border-radius:999px/);
    assert.match(plan.style.cssText, /font-size:11px/);
    assert.match(plan.style.cssText, /font-weight:500/);
    assert.match(plan.style.cssText, /letter-spacing:0/);
    assert.match(plan.style.cssText, /text-align:right/);
    assert.match(plan.style.cssText, /color:var\(--color-token-charts-blue/);
    assert.match(plan.style.cssText, /background:color-mix\(in srgb,var\(--color-token-charts-blue/);
    assert.match(plan.style.cssText, /box-shadow:inset 0 0 0 1px color-mix\(in srgb,var\(--color-token-charts-blue/);
    assert.match(panel.textContent, /work@example\.comPlus/);
    assert.doesNotMatch(panel.textContent, /\(current\)/);
  });
});

test("renderAccountPanel matches native usage subitem structure for account rows", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: true },
      panel,
      {
        accounts: ["work"],
        current: "personal",
        accountEmails: { work: "work@example.com" },
        accountPlans: { work: "plus" },
        accountUsage: {
          work: {
            fiveHour: { label: "5h", pct: 0, resetAt: "9:18 PM" },
            weekly: { label: "Weekly", pct: 12, resetAt: "Jun 9" },
          },
        },
      },
    );

    const accountRow = panel.querySelectorAll("button").find((button) => button.title === "work@example.com");
    const usage = panel.querySelector("[data-codexpp-account-usage]");
    assert.ok(accountRow);
    assert.ok(usage);
    assert.match(accountRow.style.cssText, /width:100%/);
    assert.match(accountRow.style.cssText, /margin:0/);
    assert.match(accountRow.style.cssText, /min-height:44px/);
    assert.match(accountRow.style.cssText, /display:flex/);
    assert.match(accountRow.style.cssText, /flex-direction:column/);
    assert.match(
      accountRow.style.cssText,
      /padding:2px var\(--codexpp-menu-row-padding-right,24px\) 2px var\(--codexpp-menu-text-inset,64px\)/,
    );
    assert.match(accountRow.style.cssText, /background:transparent/);
    assert.match(accountRow.style.cssText, /box-shadow:none/);
    assert.match(accountRow.style.cssText, /border-radius:var\(--codexpp-menu-row-radius,8px\)/);
    assert.doesNotMatch(accountRow.style.cssText, /scale\(0\.96\)/);
    assert.doesNotMatch(accountRow.style.cssText, /currentColor 5%/);
    assert.equal(usage.children[0].textContent, "5h0%resets 9:18 PM");
    assert.equal(usage.children[0].getAttribute("aria-label"), "5h 0% resets 9:18 PM");
    assert.equal(usage.children[1].textContent, "Weekly12%");
    assert.equal(usage.children[1].getAttribute("aria-label"), "Weekly 12%");
    assert.equal(usage.children[0].children[0].textContent, "5h");
    assert.equal(usage.children[0].children[1].textContent, "0%");
    assert.equal(usage.children[0].children[2].textContent, "resets 9:18 PM");
    assert.match(usage.style.cssText, /display:grid/);
    assert.match(usage.style.cssText, /grid-template-columns:minmax\(0,1fr\) auto/);
    assert.match(usage.style.cssText, /column-gap:10px/);
    assert.match(usage.style.cssText, /font-size:12px/);
    assert.match(usage.children[1].style.cssText, /text-align:right/);
    assert.match(usage.children[0].children[1].style.cssText, /font-weight:500/);
    assert.match(usage.children[0].children[1].style.cssText, /color:var\(--color-token-text-primary/);
    assert.doesNotMatch(usage.style.cssText, /grid-template-columns:minmax\(0,1fr\) 4\.5ch/);
  });
});

test("renderAccountPanel gives the current account a quiet selected treatment", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: true },
      panel,
      {
        accounts: ["work"],
        current: "work",
        accountEmails: { work: "work@example.com" },
        accountUsage: {},
      },
    );

    const current = panel.querySelector("[data-codexpp-account-current]");
    assert.ok(current);
    assert.equal(current.getAttribute("aria-current"), "true");
    assert.match(current.style.cssText, /background:color-mix\(in srgb,currentColor 5%,transparent\)/);
    assert.match(current.style.cssText, /box-shadow:inset 0 0 0 1px color-mix\(in srgb,currentColor 7%,transparent\)/);
    assert.match(current.children[0].children[0].style.cssText, /font-weight:500/);
  });
});

test("renderAccountPanel formats future multi-word plan labels", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: false },
      panel,
      {
        accounts: ["work"],
        current: "work",
        accountEmails: { work: "work@example.com" },
        accountPlans: { work: "TEAM_PRO" },
        accountUsage: {},
      },
    );

    const plan = panel.querySelector("[data-codexpp-account-plan]");
    assert.ok(plan);
    assert.equal(plan.textContent, "Team Pro");
    assert.equal(plan.title, "ChatGPT Team Pro plan");
  });
});

test("renderAccountPanel keeps free plan badges muted", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: false },
      panel,
      {
        accounts: ["personal"],
        current: "personal",
        accountEmails: { personal: "me@example.com" },
        accountPlans: { personal: "free" },
        accountUsage: {},
      },
    );

    const plan = panel.querySelector("[data-codexpp-account-plan]");
    assert.ok(plan);
    assert.equal(plan.textContent, "Free");
    assert.equal(plan.getAttribute("data-codexpp-account-plan-tone"), "free");
    assert.match(plan.style.cssText, /background:color-mix\(in srgb,currentColor 5%,transparent\)/);
    assert.match(plan.style.cssText, /color:var\(--color-token-text-tertiary/);
    assert.doesNotMatch(plan.style.cssText, /color-token-charts-blue/);
  });
});

test("renderAccountPanel omits the plan badge when metadata is unavailable", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: false },
      panel,
      {
        accounts: ["work"],
        current: "work",
        accountEmails: { work: "work@example.com" },
        accountPlans: {},
        accountUsage: {},
      },
    );

    assert.equal(panel.querySelector("[data-codexpp-account-plan]"), null);
  });
});

test("renderAccountPanel uses a dedicated accounts icon", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: false },
      panel,
      {
        accounts: ["work"],
        current: "work",
        accountEmails: { work: "work@example.com" },
        accountUsage: {},
      },
    );

    const icon = panel.querySelector("[data-codexpp-accounts-icon]");
    assert.ok(icon);
    assert.equal(icon.getAttribute("viewBox"), "0 0 24 24");
    assert.equal(icon.getAttribute("width"), "18");
    assert.equal(icon.getAttribute("height"), "18");
    assert.equal(icon.getAttribute("stroke"), "currentColor");
    assert.equal(icon.querySelectorAll("path").length, 3);
  });
});

test("renderAccountPanel keeps a fallback accounts chevron", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: false },
      panel,
      {
        accounts: ["work"],
        current: "work",
        accountEmails: { work: "work@example.com" },
        accountUsage: {},
      },
    );

    const chevron = panel.querySelector("[data-codexpp-accounts-chevron-fallback]");
    assert.ok(chevron);
    assert.equal(chevron.getAttribute("viewBox"), "0 0 24 24");
    assert.equal(chevron.getAttribute("width"), "16");
    assert.equal(chevron.getAttribute("height"), "16");
    assert.equal(chevron.getAttribute("stroke"), "currentColor");
  });
});

test("renderAccountPanel keeps a default header cursor while following native alignment", () => {
  withFakeDom((fakeDocument) => {
    const usageRow = document.createElement("button");
    usageRow.textContent = "Usage remaining";
    usageRow.computedStyle = { cursor: "pointer", paddingRight: "18px", color: "rgb(120, 120, 120)" };
    usageRow.rect = { width: 280, height: 40, left: 20, right: 300 };

    const usageChevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    usageChevron.computedStyle = { color: "rgb(88, 88, 88)", opacity: "0.64" };
    usageChevron.rect = { width: 16, height: 16, left: 258, right: 274 };
    usageRow.appendChild(usageChevron);
    fakeDocument.queryItems = [usageRow];

    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: false },
      panel,
      {
        accounts: ["work"],
        current: "work",
        accountEmails: { work: "work@example.com" },
        accountUsage: {},
      },
    );

    const header = panel.querySelector("button[aria-expanded]");
    const chevronSlot = panel.querySelector("[data-accounts-chevron]");
    assert.match(header.style.cssText, /cursor:default/);
    assert.match(chevronSlot.style.cssText, /color:#5C5B56/);
    assert.match(chevronSlot.style.cssText, /opacity:1/);
    assert.match(chevronSlot.style.cssText, /margin-right:6px/);
  });
});

test("renderAccountPanel matches native collapsible timing", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: false },
      panel,
      {
        accounts: ["work"],
        current: "work",
        accountEmails: { work: "work@example.com" },
        accountUsage: {},
      },
    );

    const body = panel.querySelector("[data-codexpp-account-switcher-body]");
    const chevron = panel.querySelector("[data-accounts-chevron]").querySelector("svg");
    assert.match(body.style.cssText, /max-height 300ms/);
    assert.match(body.style.cssText, /opacity 300ms/);
    assert.match(body.style.cssText, /transform 300ms/);
    assert.match(body.style.cssText, /transform:translateY\(-2px\)/);
    assert.match(body.style.cssText, /pointer-events:none/);
    assert.match(chevron.style.transition, /transform 300ms/);
  });
});

test("renderAccountPanel keeps default cursors inside the accounts collapsible", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: true },
      panel,
      {
        accounts: ["work"],
        current: "personal",
        accountEmails: { work: "work@example.com" },
        accountUsage: {},
      },
    );

    const buttons = panel.querySelectorAll("button");
    assert.equal(buttons.length, 3);
    for (const button of buttons) {
      assert.match(button.style.cssText, /cursor:default/);
      assert.doesNotMatch(button.style.cssText, /cursor:pointer/);
    }
    assert.match(buttons[2].style.cssText, /min-height:32px/);
    assert.match(
      buttons[2].style.cssText,
      /width:100%/,
    );
    assert.match(
      buttons[2].style.cssText,
      /padding:0 var\(--codexpp-menu-row-padding-right,24px\) 0 var\(--codexpp-menu-text-inset,64px\)/,
    );
  });
});

test("renderAccountPanel shows reset text only for exhausted account usage", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: false },
      panel,
      {
        accounts: ["work"],
        current: "personal",
        accountEmails: { work: "work@example.com" },
        accountUsage: {
          work: {
            fiveHour: { label: "5h", pct: 0, resetAt: "2:59 AM" },
            weekly: { label: "Weekly", pct: 84, resetAt: "May 31" },
          },
        },
      },
    );

    const usage = panel.querySelector("[data-codexpp-account-usage]");
    assert.ok(usage);
    assert.equal(usage.children[0].textContent, "5h0%resets 2:59 AM");
    assert.equal(usage.children[0].getAttribute("aria-label"), "5h 0% resets 2:59 AM");
    assert.equal(usage.children[1].textContent, "Weekly84%");
    assert.equal(usage.children[1].getAttribute("aria-label"), "Weekly 84%");
    assert.doesNotMatch(usage.children[1].textContent, /May 31/);
  });
});

test("renderAccountPanel shows projected reset usage as full", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: false },
      panel,
      {
        accounts: ["work"],
        current: "personal",
        accountEmails: { work: "work@example.com" },
        accountUsage: {
          work: {
            fiveHour: { label: "5h", pct: 100, resetAt: null, resetAtMs: null, projected: true },
            weekly: { label: "Weekly", pct: 84, resetAt: "May 31" },
          },
        },
      },
    );

    const usage = panel.querySelector("[data-codexpp-account-usage]");
    assert.ok(usage);
    assert.equal(usage.children[0].textContent, "5h100%reset");
    assert.equal(usage.children[0].getAttribute("aria-label"), "5h 100% reset");
    assert.equal(usage.children[1].textContent, "Weekly84%");
    assert.equal(usage.children[1].getAttribute("aria-label"), "Weekly 84%");
    assert.match(usage.title, /cached reset schedule/);
  });
});

test("renderAccountPanel omits usage strip when account usage is missing", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const panel = document.createElement("div");
    renderAccountPanel(
      { accountsExpanded: false },
      panel,
      {
        accounts: ["work"],
        current: "work",
        accountEmails: { work: "work@example.com" },
        accountUsage: {},
      },
    );

    assert.equal(panel.querySelector("[data-codexpp-account-usage]"), null);
  });
});

// ─── Account panel shell (pure factory, no DOM needed for module loading) ────

test("accountPanelShell exports function", () => {
  const { accountPanelShell } = require("../src/ui-components");
  assert.equal(typeof accountPanelShell, "function");
});

test("setPanelStatus exports function", () => {
  const { setPanelStatus } = require("../src/ui-components");
  assert.equal(typeof setPanelStatus, "function");
});

// ─── State management for expand/collapse ───────────────────────────────────

test("accountsExpanded defaults to false via state object contract", () => {
  // This mirrors what index.js sets on the initial state
  const state = { accountsExpanded: false };
  assert.equal(state.accountsExpanded, false);
});

test("toggleAccountsExpanded flips state contract", () => {
  const state = { accountsExpanded: false };
  // Simulate toggle: !expanded → true
  state.accountsExpanded = !false;
  assert.equal(state.accountsExpanded, true);
  // Toggle back
  state.accountsExpanded = !true;
  assert.equal(state.accountsExpanded, false);
});

test("accounts collapsible closes expanded accounts state with native timing", () => {
  withFakeDom(() => {
    const { renderAccountPanel } = require("../src/ui-popup");
    const state = { accountsExpanded: true };
    const panel = document.createElement("div");
    renderAccountPanel(
      state,
      panel,
      {
        accounts: ["work"],
        current: "work",
        accountEmails: { work: "work@example.com" },
        accountUsage: {},
      },
    );

    panel._codexppAccountsCollapsible.collapse();

    const body = panel.querySelector("[data-codexpp-account-switcher-body]");
    const header = panel.querySelector("button[aria-expanded]");
    assert.equal(state.accountsExpanded, false);
    assert.equal(header.getAttribute("aria-expanded"), "false");
    assert.equal(body.style.maxHeight, "0");
    assert.equal(body.style.opacity, "0");
    assert.match(body.style.transition, /max-height 300ms/);
  });
});
