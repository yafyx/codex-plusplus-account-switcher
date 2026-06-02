const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function unsignedToken(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.`;
}

function authWithClaims(idClaims, accessClaims = null, extra = {}) {
  return JSON.stringify({
    auth_mode: "chatgpt",
    ...extra,
    tokens: {
      id_token: unsignedToken(idClaims),
      access_token: accessClaims ? unsignedToken(accessClaims) : "access",
      refresh_token: "refresh",
    },
  });
}

function authWithEmail(email, extra = {}) {
  return authWithClaims({ email }, null, extra);
}

function authWithPlan(email, plan, extra = {}) {
  return authWithClaims(
    {
      email,
      "https://api.openai.com/auth": { chatgpt_plan_type: plan },
    },
    null,
    extra,
  );
}

async function withTempHome(fn) {
  const originalHome = process.env.HOME;
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-account-switcher-"));
  process.env.HOME = home;
  delete require.cache[require.resolve("../src/account/service")];

  try {
    return await fn(home);
  } finally {
    process.env.HOME = originalHome;
    await fs.rm(home, { recursive: true, force: true });
  }
}

async function touch(filePath, isoDate) {
  const date = new Date(isoDate);
  await fs.utimes(filePath, date, date);
}

function immediateRelaunchApi(calls, overrides = {}) {
  return {
    app: {
      relaunch() {
        calls.push("relaunch");
      },
      exit(code) {
        calls.push(`exit:${code}`);
      },
    },
    log: { info() {}, warn() {} },
    setTimeout(callback, delayMs) {
      calls.push(`delay:${delayMs}`);
      callback();
    },
    ...overrides,
  };
}

test("state includes saved account email and plan metadata", async () => {
  const originalHome = process.env.HOME;
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-account-switcher-"));
  process.env.HOME = home;
  delete require.cache[require.resolve("../src/account/service")];

  try {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    const workAuth = authWithPlan("work@example.com", "plus");
    await fs.writeFile(path.join(accountsDir, "work.json"), workAuth);
    await fs.writeFile(path.join(accountsDir, "personal.json"), authWithPlan("me@example.com", "free"));
    await fs.writeFile(path.join(codexDir, "auth.json"), workAuth);

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { warn() {} } });
    const result = await service.handle({ action: "state" });

    assert.equal(result.ok, true);
    assert.deepEqual(result.state.accountEmails, {
      personal: "me@example.com",
      work: "work@example.com",
    });
    assert.deepEqual(result.state.accountPlans, {
      personal: "free",
      work: "plus",
    });
  } finally {
    process.env.HOME = originalHome;
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("plan metadata prefers id token and falls back to access token", () => {
  const { planFromAuth, planFromAuthString } = require("../src/account/auth");
  const namespace = (plan) => ({ "https://api.openai.com/auth": { chatgpt_plan_type: plan } });

  assert.equal(
    planFromAuth({
      tokens: {
        id_token: unsignedToken(namespace("PLUS")),
        access_token: unsignedToken(namespace("free")),
      },
    }),
    "plus",
  );
  assert.equal(
    planFromAuth({
      tokens: {
        id_token: "malformed",
        access_token: unsignedToken(namespace("free")),
      },
    }),
    "free",
  );
  assert.equal(planFromAuth({ tokens: { id_token: "malformed", access_token: "malformed" } }), null);
  assert.equal(planFromAuth({ tokens: { id_token: unsignedToken({ email: "work@example.com" }) } }), null);
  assert.equal(planFromAuthString("{not-json"), null);
});

test("state includes cached account usage metadata", async () => {
  const originalHome = process.env.HOME;
  const originalNow = Date.now;
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-account-switcher-"));
  process.env.HOME = home;
  Date.now = () => 1777728300000;
  delete require.cache[require.resolve("../src/account/service")];

  try {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "work.json"), authWithEmail("work@example.com"));
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("work@example.com"));
    await fs.writeFile(
      path.join(codexDir, "auth_accounts_usage.json"),
      JSON.stringify({
        work: {
          fiveHour: { label: "5h", pct: 72, resetAt: "8:30 PM" },
          weekly: { label: "Weekly", pct: 91, resetAt: "Sat, 6:00 PM" },
          at: 1777728000000,
        },
      }),
    );

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { warn() {} } });
    const result = await service.handle({ action: "state" });

    assert.equal(result.ok, true);
    assert.deepEqual(result.state.accountUsage, {
      work: {
        fiveHour: { label: "5h", pct: 72, resetAt: "8:30 PM", resetAtMs: 1777728600000 },
        weekly: { label: "Weekly", pct: 91, resetAt: "Sat, 6:00 PM", resetAtMs: 1778324400000 },
        at: 1777728000000,
      },
    });
  } finally {
    Date.now = originalNow;
    process.env.HOME = originalHome;
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("refresh-usage stores active account usage", async () => {
  const originalHome = process.env.HOME;
  const originalNow = Date.now;
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-account-switcher-"));
  process.env.HOME = home;
  Date.now = () => 1777729300000;
  delete require.cache[require.resolve("../src/account/service")];

  try {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "work.json"), authWithEmail("work@example.com"));
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("work@example.com"));

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({
      log: { warn() {} },
      fetchActiveUsage: async () => ({
        fiveHour: { label: "5h", pct: 64, resetAt: "9:00 PM" },
        weekly: { label: "Weekly", pct: 88, resetAt: "Sun, 6:00 PM" },
        at: 1777729000000,
      }),
    });
    const result = await service.handle({ action: "refresh-usage" });

    assert.equal(result.ok, true);
    assert.deepEqual(result.state.accountUsage.work, {
      fiveHour: { label: "5h", pct: 64, resetAt: "9:00 PM", resetAtMs: 1777730400000 },
      weekly: { label: "Weekly", pct: 88, resetAt: "Sun, 6:00 PM", resetAtMs: 1777806000000 },
      at: 1777729000000,
    });
    const usageCache = JSON.parse(
      await fs.readFile(path.join(codexDir, "auth_accounts_usage.json"), "utf8"),
    );
    assert.equal(usageCache.work.fiveHour.pct, 64);
    assert.equal(usageCache.work.fiveHour.resetAtMs, 1777730400000);
  } finally {
    Date.now = originalNow;
    process.env.HOME = originalHome;
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("switch schedules detached macOS reopen from the main-process action", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    const selectedAuth = authWithEmail("work@example.com");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "work.json"), selectedAuth);

    const calls = [];
    const { createAccountService } = require("../src/account/service");
    const service = createAccountService(
      immediateRelaunchApi(calls, {
        platform: "darwin",
        execPath: "/Applications/Codex.app/Contents/MacOS/Codex",
        spawn(command, args, options) {
          calls.push({ command, args, options });
          return {
            unref() {
              calls.push("unref");
            },
          };
        },
      }),
    );
    const result = await service.handle({ action: "switch", name: "work" });

    assert.equal(result.ok, true);
    assert.equal(await fs.readFile(path.join(codexDir, "auth.json"), "utf8"), selectedAuth);
    assert.deepEqual(calls, [
      "delay:0",
      {
        command: "/bin/sh",
        args: [
          "-c",
          'sleep "$1"; exec /usr/bin/open -n "$2"',
          "codex-account-switcher-relaunch",
          "1",
          "/Applications/Codex.app",
        ],
        options: { detached: true, stdio: "ignore" },
      },
      "unref",
      "exit:0",
    ]);
  });
});

test("switch falls back to Electron relaunch outside macOS", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    const selectedAuth = authWithEmail("work@example.com");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "work.json"), selectedAuth);

    const calls = [];
    const { createAccountService } = require("../src/account/service");
    const service = createAccountService(immediateRelaunchApi(calls, { platform: "linux" }));
    const result = await service.handle({ action: "switch", name: "work" });

    assert.equal(result.ok, true);
    assert.equal(await fs.readFile(path.join(codexDir, "auth.json"), "utf8"), selectedAuth);
    assert.deepEqual(calls, ["delay:0", "relaunch", "exit:0"]);
  });
});

test("switch falls back to Electron relaunch when the macOS app root is unavailable", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "work.json"), authWithEmail("work@example.com"));

    const calls = [];
    const { createAccountService } = require("../src/account/service");
    const service = createAccountService(
      immediateRelaunchApi(calls, {
        platform: "darwin",
        execPath: "/usr/local/bin/node",
        spawn() {
          assert.fail("spawn should not be called without a macOS app root");
        },
      }),
    );
    const result = await service.handle({ action: "switch", name: "work" });

    assert.equal(result.ok, true);
    assert.deepEqual(calls, ["delay:0", "relaunch", "exit:0"]);
  });
});

test("switch falls back to Electron relaunch when the detached macOS helper fails", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "work.json"), authWithEmail("work@example.com"));

    const calls = [];
    const { createAccountService } = require("../src/account/service");
    const service = createAccountService(
      immediateRelaunchApi(calls, {
        platform: "darwin",
        execPath: "/Applications/Codex.app/Contents/MacOS/Codex",
        spawn() {
          calls.push("spawn");
          throw new Error("spawn failed");
        },
      }),
    );
    const result = await service.handle({ action: "switch", name: "work" });

    assert.equal(result.ok, true);
    assert.deepEqual(calls, ["delay:0", "spawn", "relaunch", "exit:0"]);
  });
});

test("clear-active schedules the same detached macOS reopen after backing up auth", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const selectedAuth = authWithEmail("work@example.com");
    await fs.mkdir(codexDir, { recursive: true });
    await fs.writeFile(path.join(codexDir, "auth.json"), selectedAuth);
    await fs.writeFile(path.join(codexDir, "current_account"), "work\n");

    const calls = [];
    const { createAccountService } = require("../src/account/service");
    const service = createAccountService(
      immediateRelaunchApi(calls, {
        platform: "darwin",
        execPath: "/Applications/Codex.app/Contents/MacOS/Codex",
        spawn(command, args, options) {
          calls.push({ command, args, options });
          return {
            unref() {
              calls.push("unref");
            },
          };
        },
      }),
    );
    const result = await service.handle({ action: "clear-active" });

    assert.equal(result.ok, true);
    await assert.rejects(fs.stat(path.join(codexDir, "auth.json")), { code: "ENOENT" });
    await assert.rejects(fs.stat(path.join(codexDir, "current_account")), { code: "ENOENT" });
    const backupNames = (await fs.readdir(codexDir)).filter((name) =>
      name.startsWith("auth.account-switcher-backup-"),
    );
    assert.equal(backupNames.length, 1);
    assert.equal(await fs.readFile(path.join(codexDir, backupNames[0]), "utf8"), selectedAuth);
    assert.deepEqual(calls, [
      "delay:0",
      {
        command: "/bin/sh",
        args: [
          "-c",
          'sleep "$1"; exec /usr/bin/open -n "$2"',
          "codex-account-switcher-relaunch",
          "1",
          "/Applications/Codex.app",
        ],
        options: { detached: true, stdio: "ignore" },
      },
      "unref",
      "exit:0",
    ]);
  });
});

test("switch syncs API account base URL into Codex config", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "chatgpt.json"), authWithEmail("me@example.com"));
    await fs.writeFile(
      path.join(accountsDir, "api.json"),
      `${JSON.stringify(
        {
          auth_mode: "apikey",
          OPENAI_API_KEY: "sk-test",
          base_url: "https://example.com/v1",
        },
        null,
        2,
      )}\n`,
    );
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("me@example.com"));
    await fs.writeFile(
      path.join(codexDir, "config.toml"),
      'model = "gpt-5.5"\n\n[projects.test]\ntrust_level = "trusted"\n',
    );

    const calls = [];
    const { createAccountService } = require("../src/account/service");
    const service = createAccountService(immediateRelaunchApi(calls, { platform: "linux" }));
    const apiResult = await service.handle({ action: "switch", name: "api" });

    assert.equal(apiResult.ok, true);
    assert.match(
      await fs.readFile(path.join(codexDir, "config.toml"), "utf8"),
      /^openai_base_url = "https:\/\/example\.com\/v1"$/m,
    );

    const chatgptResult = await service.handle({ action: "switch", name: "chatgpt" });
    assert.equal(chatgptResult.ok, true);
    assert.doesNotMatch(
      await fs.readFile(path.join(codexDir, "config.toml"), "utf8"),
      /^openai_base_url\s*=/m,
    );
  });
});

test("switch leaves config unchanged for API account without base URL", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(
      path.join(accountsDir, "api.json"),
      `${JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: "sk-test" }, null, 2)}\n`,
    );
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("me@example.com"));
    const config = 'openai_base_url = "https://existing.example/v1"\nmodel = "gpt-5.5"\n';
    await fs.writeFile(path.join(codexDir, "config.toml"), config);

    const calls = [];
    const { createAccountService } = require("../src/account/service");
    const service = createAccountService(immediateRelaunchApi(calls, { platform: "linux" }));
    const result = await service.handle({ action: "switch", name: "api" });

    assert.equal(result.ok, true);
    assert.equal(await fs.readFile(path.join(codexDir, "config.toml"), "utf8"), config);
  });
});

test("switch still copies account when base URL sync cannot parse JSON", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "broken.json"), "{not valid json");
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("me@example.com"));
    const warnings = [];

    const calls = [];
    const { createAccountService } = require("../src/account/service");
    const service = createAccountService(
      immediateRelaunchApi(calls, {
        platform: "linux",
        log: {
          info() {},
          warn(message) {
            warnings.push(message);
          },
        },
      }),
    );
    const result = await service.handle({ action: "switch", name: "broken" });

    assert.equal(result.ok, true);
    assert.equal(await fs.readFile(path.join(codexDir, "auth.json"), "utf8"), "{not valid json");
    assert.equal((await fs.readFile(path.join(codexDir, "current_account"), "utf8")).trim(), "broken");
    assert.match(warnings[0], /skipped base URL sync/);
  });
});

test("clear-active removes configured base URL", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    await fs.mkdir(codexDir, { recursive: true });
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("me@example.com"));
    await fs.writeFile(
      path.join(codexDir, "config.toml"),
      'openai_base_url = "https://existing.example/v1"\nmodel = "gpt-5.5"\n',
    );

    const calls = [];
    const { createAccountService } = require("../src/account/service");
    const service = createAccountService(immediateRelaunchApi(calls, { platform: "linux" }));
    const result = await service.handle({ action: "clear-active" });

    assert.equal(result.ok, true);
    assert.doesNotMatch(
      await fs.readFile(path.join(codexDir, "config.toml"), "utf8"),
      /^openai_base_url\s*=/m,
    );
  });
});

test("state hides duplicate email accounts and keeps the active match", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });

    const oldAuth = authWithEmail("work@example.com", { profile_id: "old" });
    const activeAuth = authWithEmail("work@example.com", { profile_id: "active" });
    await fs.writeFile(path.join(accountsDir, "work-old.json"), oldAuth);
    await fs.writeFile(path.join(accountsDir, "work-current.json"), activeAuth);
    await fs.writeFile(path.join(codexDir, "auth.json"), activeAuth);
    await touch(path.join(accountsDir, "work-old.json"), "2026-05-13T10:00:00.000Z");
    await touch(path.join(accountsDir, "work-current.json"), "2026-05-12T10:00:00.000Z");

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { warn() {} } });
    const result = await service.handle({ action: "state" });

    assert.equal(result.ok, true);
    assert.deepEqual(result.state.accounts, ["work-current"]);
    assert.equal(result.state.current, "work-current");
    assert.deepEqual(result.state.accountEmails, { "work-current": "work@example.com" });
    assert.deepEqual((await fs.readdir(accountsDir)).sort(), ["work-current.json", "work-old.json"]);
  });
});

test("state refreshes matching saved email instead of creating generic autosave", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });

    const oldAuth = authWithEmail("work@example.com", { profile_id: "old-token" });
    const refreshedAuth = authWithEmail("work@example.com", { profile_id: "refreshed-token" });
    await fs.writeFile(path.join(accountsDir, "work.json"), oldAuth);
    await fs.writeFile(path.join(codexDir, "auth.json"), refreshedAuth);

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { warn() {} } });
    const result = await service.handle({ action: "state" });

    assert.equal(result.ok, true);
    assert.deepEqual(result.state.accounts, ["work"]);
    assert.equal(result.state.current, "work");
    assert.equal(await fs.readFile(path.join(accountsDir, "work.json"), "utf8"), refreshedAuth);
    await assert.rejects(fs.stat(path.join(accountsDir, "account.json")), { code: "ENOENT" });
  });
});

test("state hides duplicate email accounts and keeps newest when none is active", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });

    await fs.writeFile(path.join(accountsDir, "work-old.json"), authWithEmail("work@example.com", { profile_id: "old" }));
    await fs.writeFile(path.join(accountsDir, "work-new.json"), authWithEmail("work@example.com", { profile_id: "new" }));
    await fs.writeFile(path.join(accountsDir, "other.json"), authWithEmail("other@example.com"));
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("active@example.com"));
    await touch(path.join(accountsDir, "work-old.json"), "2026-05-12T10:00:00.000Z");
    await touch(path.join(accountsDir, "work-new.json"), "2026-05-13T10:00:00.000Z");

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { warn() {} } });
    const result = await service.handle({ action: "state" });

    assert.equal(result.ok, true);
    assert.deepEqual(result.state.accounts, ["account", "other", "work-new"]);
    assert.equal(result.state.current, "account");
    assert.equal(result.state.accountEmails["work-new"], "work@example.com");
    assert.deepEqual(
      (await fs.readdir(accountsDir)).filter((name) => name.startsWith("work-")).sort(),
      ["work-new.json", "work-old.json"],
    );
  });
});

test("usage summary includes reset time for exhausted windows", () => {
  const { accountUsageSummary } = require("../src/ui-components");
  const originalNow = Date.now;
  Date.now = () => 1777728300000;

  try {
    const summary = accountUsageSummary(
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

    assert.equal(summary, "5h 0%, resets 8:30 PM · Weekly 0%, resets Sat, 6:00 PM");
  } finally {
    Date.now = originalNow;
  }
});

test("cached usage projects windows to full after reset time has passed", () => {
  const { normalizeUsageSnapshot } = require("../src/account/usage");
  const originalNow = Date.now;
  Date.now = () => 1777732200000;

  try {
    const usage = normalizeUsageSnapshot({
      fiveHour: { label: "5h", pct: 0, resetAt: "8:30 PM", resetAtMs: 1777728600000 },
      weekly: { label: "Weekly", pct: 84, resetAt: "Sat, 6:00 PM", resetAtMs: 1778324400000 },
      at: 1777728000000,
    });

    assert.deepEqual(usage.fiveHour, {
      label: "5h",
      pct: 100,
      resetAt: null,
      resetAtMs: null,
      projected: true,
    });
    assert.equal(usage.weekly.pct, 84);
  } finally {
    Date.now = originalNow;
  }
});

test("usage summary omits cache age for non-exhausted windows", () => {
  const { accountUsageSummary } = require("../src/ui-components");
  const originalNow = Date.now;
  Date.now = () => 1777728300000;

  try {
    const summary = accountUsageSummary(
      {
        accountUsage: {
          work: {
            fiveHour: { label: "5h", pct: 92, resetAt: "8:30 PM" },
            weekly: { label: "Weekly", pct: 82, resetAt: "Sat, 6:00 PM" },
            at: 1777728000000,
          },
        },
      },
      "work",
    );

    assert.equal(summary, "5h 92% · Weekly 82%");
  } finally {
    Date.now = originalNow;
  }
});
