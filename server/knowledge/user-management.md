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
Click the edit icon on any user row to update their display name, role, or password. You cannot change a user's username after creation.

## Resetting a Password
1. Open the edit dialog for the user
2. Enter a new password in the Password field
3. Save

The user will need to be informed of their new password — there is no automated email reset.

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
- There is no "remember me" option — all sessions expire
- Multiple users can be logged in simultaneously with no conflicts

## Password Requirements
The app enforces basic password requirements (minimum length). For security, use unique passwords per user — never share the admin password.
