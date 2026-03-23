# Tax Codes

## Overview
Tax codes connect chart of accounts entries to specific lines on tax forms. The system includes 500+ pre-seeded codes for major forms: 1040, 1065, 1120, 1120S, and common codes.

## Tax Code Tables
- `tax_codes`: canonical codes with form type, category, description, sort order
- `tax_code_software_maps`: per-software mappings (UltraTax, CCH, Lacerte, GoSystem, Generic)

## Browsing Tax Codes
1. Go to **Admin > Tax Codes** (admin only)
2. Use filters: Form Type (1040/1065/1120/1120S), Software, Activity Type
3. Search by code, description, or category
4. Click any code to see all software mappings

## Creating Custom Codes
1. On the Tax Codes page, click **New Tax Code**
2. Enter: code string, description, form type, category, sort order
3. Add software mappings for each software you use
4. Save — the code is immediately available for assignment in Tax Mapping

## Software Mappings
Each tax code can have different line references per software:
- **UltraTax**: line/schedule references for UltraTax CS
- **CCH**: line references for CCH Axcess / ProSystem fx
- **Lacerte**: Lacerte input screen references
- **GoSystem**: GoSystem Tax RS references
- **Generic**: software-agnostic description

## CSV Import/Export
- Export all tax codes to CSV: **Export CSV** button on Tax Codes page
- Import tax codes from CSV: **Import CSV** button; the system maps columns automatically
- Useful for bulk-loading firm-specific custom codes

## Legacy `tax_line` Field
The chart of accounts has a `tax_line` VARCHAR field (legacy). When you assign a `tax_code_id`, the system also writes the tax code string to `tax_line` for backward compatibility with older exports.
