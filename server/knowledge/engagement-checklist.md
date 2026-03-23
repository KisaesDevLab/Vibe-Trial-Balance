# Engagement Checklist

## Overview
The Engagement Checklist is a per-period task list for tracking the steps required to complete an engagement. It supports the full workflow from data collection through final sign-off.

Access: **Setup > Engagement** (with a period selected)

## Task Statuses
Each task moves through these statuses:
- **Open**: Not yet started
- **In Progress**: Work has begun
- **Review**: Ready for manager review
- **Completed**: Done and signed off
- **N/A**: Not applicable for this engagement

## Creating Tasks
1. Go to **Setup > Engagement**
2. Click **New Task**
3. Enter:
   - **Task name**: Short description of the work item
   - **Category**: Grouping (e.g., "Bookkeeping", "Tax", "Review", "Final")
   - **Assignee**: Optional — assign to a specific user
   - **Notes**: Any context or instructions
4. Tasks can be sorted by dragging (sort_order)

## Updating a Task
Click any task row to expand it. Change the status from the dropdown, add or edit notes, or reassign to a different user. Status changes are timestamped — completed tasks record who completed them and when.

## Category Grouping
Tasks are grouped by category on the page. Common categories used in accounting engagements:
- **Setup**: COA verification, period creation, prior year import
- **Bookkeeping**: Bank reconciliation, transaction classification, journal entries
- **Tax**: Tax mapping, M-1 adjustments, tax code export
- **Review**: Partner/manager review items
- **Final**: Lock period, generate workpaper package, client delivery

## All Open Items View
Go to **Setup > Engagement** and click **All Open Items** to see all open or in-progress tasks across **all clients and periods** in one consolidated view. This is useful for a manager or firm-level view of outstanding work.

Each row in All Open Items has a **View Checklist →** link to jump directly to that period's engagement page.

## Using the Checklist for Period Close
The recommended period close workflow:
1. Complete all bookkeeping tasks (bank rec, classifications confirmed, journal entries posted)
2. Complete all tax tasks (tax mapping 100%, M-1 reviewed)
3. Mark all tasks Completed or N/A
4. Run AI Diagnostics to check for issues
5. Lock the period

The MCP `full_period_close` prompt follows this same workflow automatically.

## Engagement Summary
The **Reports > Engagement Summary** page shows completion percentages by category across all periods, giving a firm-wide view of where work stands.

## Roll-Forward Behavior
Engagement tasks are **not** copied during roll-forward. Each new period starts with a blank checklist. This is intentional — each period's tasks should be freshly created based on that year's scope of work. If you use the same checklist every year, save a custom COA template (not applicable — use a copy-paste workflow for task templates).
