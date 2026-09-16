# User Management

## Overview
Admins manage all app users at **Admin > Users**. This page is only visible to admin-role users.

## User Roles
The app has three roles:

| Role | Access |
|---|---|
| **Admin** | Full access: all client work + user management, tax codes, COA templates, backup/restore, audit log, period unlock, MCP token management |
| **Preparer** (staff) | Standard access: TB editing, journal entries, bank transactions, tax mapping, reports, engagement tasks |
| **Reviewer** | Read-only: can view all pages but cannot edit the TB, post journal entries, or perform any write operations |

## Creating a User
1. Go to **Admin > Users**
2. Click **New User**
3. Enter:
   - **Username**: Used for login (must be unique, lowercase recommended)
   - **Display Name**: Shown in the UI and audit log
   - **Role**: admin, staff (preparer), or reviewer
   - **Password**: Initial password — the user can change it after first login
4. Save

## Editing a User
Click the edit icon on any user row to update their display name, email, role, or password. You cannot change a user's username after creation.

The email field is optional but is required for self-service password reset — without an email on file, that user can only be reset via the admin flow below.

## Resetting a Password

### Self-service (when SMTP/Postmark/Emailit is configured)
A user who has an email on file can click **Forgot password?** on the login page, enter their username or email, and receive a one-time reset link valid for 30 minutes. Used or expired links cannot be reused. The "Forgot password?" link is hidden when the server has no `MAIL_TRANSPORT` configured.

### Admin-initiated (always available)
1. Open the edit dialog for the user
2. Enter a new password in the Password field
3. Save

The user is forced to rotate this temporary password on their next login. Inform them of the new password through a secure channel.

## Deactivating a User
To prevent a user from logging in without deleting their history:
- Edit the user and change their role, or
- Change their password to something they don't know

User records are not deleted because their actions are preserved in the audit log. The audit log references the user by ID — deleting a user would break those references.

## The mcp_agent System User
The `mcp_agent` user is created automatically by the database migration. It appears in the user list but:
- Its password hash is set to `!` — it is impossible to log in as this user through the web UI
- It exists solely to attribute MCP (Claude Desktop) actions in the audit log
- Do not delete or modify this user

## Login and Sessions
- Sessions use JWT tokens that expire after a fixed period
- If a user sees "Token expired", they need to log out and log back in
- Sessions always expire; the only thing that persists is a "remembered browser" (see below), which skips the second-factor prompt but never the password
- Multiple users can be logged in simultaneously with no conflicts

## Two-Factor Authentication (Authenticator App)
Any user can add a second factor under **Settings > Account & security > Two-factor authentication**:
1. Click **Enable authenticator app** and confirm your password
2. Scan the QR code with Google Authenticator, Microsoft Authenticator, 1Password, Authy or any TOTP app (or type the key shown under "Can't scan?")
3. Enter the 6-digit code the app shows to finish

From then on, signing in with a password asks for the current code. Codes change every 30 seconds and each code works once. **Turn off** requires your password and a current code.

## Passkeys
A passkey signs you in with your fingerprint, face or device PIN — no password and no code. Add one under **Settings > Account & security > Passkeys** (confirm your password, then follow the browser prompt). On the login screen, click **Sign in with a passkey** and pick your account.

Passkeys are bound to the app's public address. An admin must set **Public app URL** under **Settings > Sign-in security** to the https address users open; until then the passkey buttons explain why they are unavailable. (Development on `http://localhost` also works.)

If you sign in by password and own a passkey, you are still asked for a second factor — answer with the passkey or an authenticator code.

## Remembered Browsers
When entering a code, tick **Remember this browser for 30 days** to skip the prompt on that browser. The list of remembered browsers, with a **Revoke** action, is under **Settings > Account & security > Trusted browsers**. Don't use it on a shared computer.

## Requiring 2FA for Everyone (Admin)
Under **Settings > Sign-in security**, an admin can turn on **Require two-factor authentication for everyone**. From then on, a user with no authenticator app and no passkey is shown only the enrolment screen at their next sign-in until they set one up. Users who already have a factor are unaffected. The Users page shows a **2FA** column so an admin can see who has enrolled.

## Resetting a User's 2FA (Admin)
If a user loses their phone or passkey device, an admin opens **Admin > Users** and clicks **Reset 2FA** on the row. This removes the user's authenticator app, every passkey and every remembered browser (audit-logged). The user signs in with their password alone and sets up a new factor (immediately, if 2FA is required firm-wide).

### Locked-out sole admin
If the only admin loses their authenticator, there is no web path back in — by design. On the server run:

```
npm run reset-2fa -- <username>          # development checkout
node dist/reset-2fa.js <username>        # production build
docker compose exec api node dist/reset-2fa.js <username>
```

This does exactly what the admin button does and writes the same audit row.

Two-factor enrolments are per installation and are **not** included in backups; after restoring onto a new server, users set their factors up again.

## Password Requirements
Passwords must meet all of the following:
- **Minimum 8 characters** (maximum 128)
- At least **one uppercase letter** (A–Z)
- At least **one lowercase letter** (a–z)
- At least **one number** (0–9)

For security, use unique passwords per user — never share the admin password. The bootstrap `admin` / `admin1234` credential is only valid until the forced-change screen on first login; after that the rotated password is the only one that works.
