# User-Approved Enhancements Baseline (LOCKED)

This document serves as the **Change Control Baseline**. Features listed here have been explicitly requested and approved by the user. 
**RULE:** No change may remove, disable, or regress these features without explicit written instruction in the prompt.

## 1. Weekly Timeline (Daily Tasks View)
*   **Visual Structure:** Horizontal, scrollable timeline of 7 days.
*   **Card Styling:** 
    *   **Title:** Must be `text-sm` and `font-bold` (Visual Hierarchy).
    *   **Priority Indicator:** Must be a **colored dot** (circle) in the top-right, using `appConfig.itemColors` or standard traffic light colors (Red/Amber/Green).
    *   **Done State:** When status is `DONE` or `ARCHIVED`, the card must be greyed out (opacity reduced), background darker, and title struck-through.
*   **Interaction:** Clicking a day header focuses that date.

## 2. Task Management
*   **TaskDetailModal:** 
    *   Must reflect **Live Data**. Updates (status changes, new logs) must appear immediately without closing/reopening.
    *   Must support Subtasks with progress bars.
    *   Must support file attachments.
*   **DayFocusModal:**
    *   Must split view into "Task Pool" (Backlog for day) and "Processed" (Active execution).
    *   Tasks must move between columns instantly.

## 3. Data & Persistence
*   **Offline First:** Data saves to `localStorage` ('protrack_data').
*   **Cloud Sync:** Optional Firebase synchronization.
*   **Settings:** 
    *   Customizable Statuses, Priorities, and Observation groups.
    *   Resource Health Monitor (1MB limit tracking).

## 4. Visual Theme
*   **Mode:** Dark Mode / Light Mode support (Tailwind `dark:` classes).
*   **Typography:** Inter font family.
*   **Design Language:** Lucide Icons, Rounded corners (`rounded-xl`+), Slate/Indigo color palette.

## 5. Automation
*   **AI Reporting:** Gemini-powered weekly summaries.
*   **Daily Journal:** Auto-link logs to specific tasks.
