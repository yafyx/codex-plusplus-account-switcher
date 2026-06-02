const assert = require("node:assert/strict");
const test = require("node:test");

function withMockedIpc(invoke, fn) {
  const usageRefreshPath = require.resolve("../src/usage-refresh");
  const ipcPath = require.resolve("../src/ipc");
  const originalIpc = require.cache[ipcPath];
  delete require.cache[usageRefreshPath];
  require.cache[ipcPath] = {
    id: ipcPath,
    filename: ipcPath,
    loaded: true,
    exports: { invoke },
  };

  try {
    return fn(require("../src/usage-refresh"));
  } finally {
    delete require.cache[usageRefreshPath];
    if (originalIpc) require.cache[ipcPath] = originalIpc;
    else delete require.cache[ipcPath];
  }
}

test("refreshUsageInBackground throttles repeated refreshes", async () => {
  const originalNow = Date.now;
  Date.now = () => 1_000;
  try {
    await withMockedIpc(
      () => Promise.resolve({ accounts: ["work"] }),
      async ({ refreshUsageInBackground }) => {
        const rendered = [];
        const state = {
          api: { log: { warn() {} } },
          usageRefreshInFlight: false,
          lastUsageRefreshAt: -60_000,
        };

        refreshUsageInBackground(state, (accountState) => rendered.push(accountState));
        await Promise.resolve();
        await Promise.resolve();
        refreshUsageInBackground(state, (accountState) => rendered.push(accountState));
        await Promise.resolve();

        assert.deepEqual(rendered, [{ accounts: ["work"] }]);
        assert.equal(state.lastUsageRefreshAt, 1_000);
        assert.equal(state.usageRefreshInFlight, false);
      },
    );
  } finally {
    Date.now = originalNow;
  }
});

test("refreshUsageInBackground ignores concurrent refreshes", async () => {
  let invokeCount = 0;
  let resolveRefresh;
  const originalNow = Date.now;
  Date.now = () => 10_000;
  try {
    await withMockedIpc(
      () => {
        invokeCount += 1;
        return new Promise((resolve) => {
          resolveRefresh = resolve;
        });
      },
      async ({ refreshUsageInBackground }) => {
        const rendered = [];
        const state = {
          api: { log: { warn() {} } },
          usageRefreshInFlight: false,
          lastUsageRefreshAt: -60_000,
        };

        refreshUsageInBackground(state, (accountState) => rendered.push(accountState));
        refreshUsageInBackground(state, (accountState) => rendered.push(accountState));
        assert.equal(invokeCount, 1);
        assert.equal(state.usageRefreshInFlight, true);

        resolveRefresh({ accounts: ["work"] });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        assert.deepEqual(rendered, [{ accounts: ["work"] }]);
        assert.equal(state.usageRefreshInFlight, false);
      },
    );
  } finally {
    Date.now = originalNow;
  }
});
