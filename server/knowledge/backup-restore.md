# Backup & Restore

## Overview
The Backup & Restore feature (Admin only) creates `.tbak` backup files that can be used to restore data on the same or a different installation.

## Backup Levels
Four backup levels are available:
- **Full**: Everything — all clients, periods, COA, TB, JEs, bank transactions, settings, tax codes
- **Settings**: App settings and tax code configuration only (no client data)
- **Client**: One client's complete data — COA, periods, TB, JEs, bank transactions, tickmarks, documents
- **Period**: One specific period's data — TB entries, JEs, variance notes, tickmarks

## Creating a Backup
1. Go to **Admin > Backup & Restore**
2. Select backup level
3. For Client or Period backups, select the specific client/period
4. Click **Create Backup**
5. The `.tbak` file downloads automatically

## Restore Modes
When restoring a `.tbak` file, choose the restore mode:
- **as_new**: Import as a new client (creates new records, no overwriting)
- **replace**: Replace the existing client/period data (destructive — use with caution)
- **merge_period**: Add the backed-up period to an existing client
- **settings**: Restore settings only (does not touch client data)

## How to Restore
1. Go to **Admin > Backup & Restore**
2. Click **Restore from Backup**
3. Upload the `.tbak` file
4. Select the restore mode
5. Confirm the restore — a preview shows what will be created or overwritten

## Nightly Schedule
A nightly backup can be scheduled to run automatically:
1. Go to the Backup page and toggle **Enable Nightly Backup**
2. Set the time (default: 2:00 AM server time)
3. Set the backup level (Full recommended for nightly)
4. Backups are stored in the server's backup directory

## .tbak Format
`.tbak` files are ZIP archives containing JSON data. They can be opened with any ZIP utility if manual inspection is needed.
