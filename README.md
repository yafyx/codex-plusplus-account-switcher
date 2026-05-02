# Account Switcher

Codex++ tweak that adds an Accounts page to the Codex++ settings sidebar and quick account controls to Codex's account/settings popup.

It follows the same storage model as `codex-auth`:

- active auth: `~/.codex/auth.json`
- saved accounts: `~/.codex/auth_accounts/<name>.json`
- current account marker: `~/.codex/current_account`

## Features

- Automatically save the active auth file as `account`, `account-2`, etc. when it does not match any saved profile.
- Display saved accounts as email addresses when the email is available in the auth token.
- Add another account by backing up and clearing the active auth file so Codex can sign in again.
- Switch between saved accounts from the account/settings popup.
- Use the account selector in the sidebar settings popup for quick switching.
- Switch between saved accounts from the dedicated Accounts settings page.
- Remove saved account snapshots.
- Clear the active auth file so Codex can log in with another account, then reload to show the login screen.

Switching replaces `~/.codex/auth.json` and reloads Codex so the running window applies the selected account.

## Verification

```sh
node --check index.js
```
