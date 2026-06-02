const assert = require("node:assert/strict");
const test = require("node:test");
const { authReloadMessage } = require("../src/action-messages");

test("authReloadMessage reports clear-active relaunch copy", () => {
  assert.equal(authReloadMessage("clear-active", {}), "Session cleared. Relaunching Codex for sign-in...");
});

test("authReloadMessage reports switched account email", () => {
  const message = authReloadMessage("switch", {
    current: "work",
    accountEmails: { work: "work@example.com" },
  });

  assert.equal(message, "Switched to work@example.com. Relaunching Codex...");
});

test("authReloadMessage falls back when switched account is missing", () => {
  assert.equal(authReloadMessage("switch", {}), "Switched to selected account. Relaunching Codex...");
});
