# Audit Log

## Overview
The Audit Log records every significant action taken in the app — who did what, when, and to which record. Access: **Admin > Audit Log** (admin only)

## What Gets Logged
Every write operation in the system creates an audit log entry:
- Trial balance edits (account-level changes)
- Journal entries created, modified, or deleted
- Period lock and unlock events
- Tax code assignments
- User creation and password changes
- Bank transaction classification and reclassification
- Import events (CSV, PDF, OFX)
- Backup and restore operations
- MCP tool calls (attributed to the `mcp_agent` system user)
- Settings changes (API key updates, MCP token generation/rotation/revocation)

## Viewing the Audit Log
1. Go to **Admin > Audit Log**
2. The log shows the most recent 50 entries by default
3. Use the **Next Page** button to page through older entries (50 per page, up to 200 shown)

## Filtering
Use the filter controls to narrow the log:
- **Entity Type**: Filter by the type of record affected (e.g., `trial_balance`, `journal_entry`, `period`, `user`, `mcp_tool`)
- **Action**: Filter by the action taken (e.g., `lock`, `unlock`, `create`, `update`, `delete`)
- **Date Range**: Show entries from a specific time window
- **User**: Filter by the user who performed the action

Filters can be combined. Click **Clear Filters** to reset.

## Understanding Log Entries
Each entry shows:
- **Timestamp**: When the action occurred
- **User**: Who performed the action (username and display name)
- **Action**: What was done (verb, e.g., "lock", "create", "update")
- **Entity Type**: What kind of record was affected
- **Entity ID**: The database ID of the affected record
- **Description**: A human-readable summary of the change

Long descriptions are truncated — click **Expand** to see the full text.

## MCP Agent Entries
Actions taken via the MCP integration (Claude Desktop) appear with user `mcp_agent`. This is a system user created specifically to attribute automated actions in the audit trail. If you see `mcp_agent` entries, they represent actions Claude took on your behalf through an MCP connection.

## Common Uses
- **Tracing a change**: "Who changed this balance?" — filter by entity_type=trial_balance and the period date range
- **Security review**: "What did this user do?" — filter by user
- **MCP activity**: "What did Claude do?" — filter by user = mcp_agent
- **Period close review**: "What happened during the close?" — filter by date range for the closing period
- **Incident investigation**: Find the exact time and actor for any suspicious change

## Retention
Audit log entries are never automatically deleted. They accumulate over time and provide a permanent record of all system activity.
