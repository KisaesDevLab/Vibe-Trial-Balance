# Chart of Accounts Templates

## Overview
COA Templates let you apply a pre-built or custom chart of accounts to a new client, saving setup time. Templates are managed at **Admin > COA Templates** (admin only).

## System Templates
Seven professionally designed templates are built into the app:

| Template | Best For |
|---|---|
| General Business | Default for most clients |
| Retail | Inventory-based businesses |
| Restaurant | Food & beverage operations |
| Professional Services | Consulting, legal, medical practices |
| Real Estate | Rental property and real estate investors |
| Construction | Contractors and builders |
| Farm | Agricultural operations |

System templates are read-only — they cannot be edited or deleted. They include pre-mapped tax codes where applicable.

## Custom Templates
Admins can create and maintain their own templates:

### Creating a Template from Scratch
1. Go to **Admin > COA Templates**
2. Click the **Custom** tab
3. Click **New Template**
4. Enter a name and description
5. Add accounts manually or import from CSV

### Creating a Template from an Existing Client
1. Go to **Admin > COA Templates**
2. Click **Create from Client**
3. Select the client whose COA you want to use as a template
4. Give the template a name
5. All active accounts from the client (including tax code assignments) are copied into the template

### Importing Template Accounts from CSV
1. Open a custom template
2. Click **Import from CSV**
3. Upload a CSV with columns: account_number, account_name, category, normal_balance, and optionally tax_code
4. Review the preview and confirm

### Exporting a Template to CSV
Click **Export CSV** on any template to download a CSV of all its accounts. Useful for reviewing, bulk-editing, and re-importing.

## Applying a Template to a Client

### What "Apply" Does
Applying a template copies its accounts into a client's chart of accounts. You choose one of two modes:

**Merge mode** (default): Adds template accounts that don't already exist. Existing accounts are left unchanged. Use this to add a standard set of accounts to a partially-built COA.

**Replace mode**: Removes all existing accounts and replaces them with the template accounts. Use this only for new clients with no data — replacing accounts that have journal entries or TB balances is blocked.

### How to Apply
1. Go to **Admin > COA Templates**
2. Click **Apply** on the template you want to use
3. Select the target client
4. Choose **Merge** or **Replace**
5. Review the preview (shows how many accounts will be added/replaced)
6. Click **Apply**

## Managing Custom Templates
- **Edit**: Change the template name and description; add, edit, or delete individual accounts
- **Delete**: Permanently removes the template (does not affect clients where it was previously applied)
- **Duplicate**: Creates a copy of a template for customization

## Tips
- Start new clients with a system template and use **Merge** to add any client-specific accounts
- Use **Create from Client** for a "star client" whose COA you want to reuse across similar engagements
- Custom templates retain tax code assignments — applying them to a new client pre-populates tax mapping
