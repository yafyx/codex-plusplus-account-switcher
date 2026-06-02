const { t } = require("./i18n");
const { accountDisplayName } = require("./ui-components");

function authReloadMessage(action, accountState) {
  if (action === "clear-active") {
    return t("accounts.sessionClearedRelaunching");
  }
  const email = accountState.current
    ? accountDisplayName(accountState, accountState.current, { includeCurrent: false })
    : t("accounts.selected");
  return t("accounts.switchedRelaunching", { email });
}

module.exports = { authReloadMessage };
