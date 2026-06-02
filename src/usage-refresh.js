const { errorMessage } = require("./utils");
const { invoke } = require("./ipc");

const USAGE_REFRESH_INTERVAL_MS = 60_000;

function refreshUsageInBackground(state, render) {
  const now = Date.now();
  if (state.usageRefreshInFlight || now - (state.lastUsageRefreshAt || 0) < USAGE_REFRESH_INTERVAL_MS) {
    return;
  }

  state.usageRefreshInFlight = true;
  state.lastUsageRefreshAt = now;
  invoke(state, "refresh-usage")
    .then((accountState) => {
      render(accountState);
    })
    .catch((error) => {
      state.api.log.warn("[account-switcher] usage refresh failed", errorMessage(error));
    })
    .finally(() => {
      state.usageRefreshInFlight = false;
    });
}

module.exports = { USAGE_REFRESH_INTERVAL_MS, refreshUsageInBackground };
