# Feature Plan: Add Week Plan/Reality to Daily Ritual View

## Overview
Add `week plan` and `week reality` properties from the Week Planning database to the Daily Ritual tab, displayed to the LEFT of each week's days.

## Current State
- **Git Commit**: `839437c7549adfa3b6ddd45e9ef43eb0b36e6061`
- **Layout**: 7-column grid of day blocks (no week context)
- **Data**: Only fetches Daily Ritual database

## Target Layout
```
┌──────────────────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┐
│   WEEK BLOCK     │  Mon  │  Tue  │  Wed  │  Thu  │  Fri  │  Sat  │  Sun  │
│                  │       │       │       │       │       │       │       │
│  Week Plan:      │ Daily │ Daily │ Daily │ Daily │ Daily │ Daily │ Daily │
│  [editable]      │ Plan  │ Plan  │ Plan  │ Plan  │ Plan  │ Plan  │ Plan  │
│                  │       │       │       │       │       │       │       │
│  Week Reality:   │ Daily │ Daily │ Daily │ Daily │ Daily │ Daily │ Daily │
│  [editable]      │Reality│Reality│Reality│Reality│Reality│Reality│Reality│
├──────────────────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│   WEEK BLOCK     │  Mon  │  Tue  │  Wed  │  Thu  │  Fri  │  Sat  │  Sun  │
│   (next week)    │  ...  │  ...  │  ...  │  ...  │  ...  │  ...  │  ...  │
└──────────────────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┘
```

## Implementation Steps

### Step 1: Backend - Add Week Planning Data Fetcher
**File**: `lib/notion.ts`

Add new functions:
```typescript
interface WeekEntry {
  weekId: string;
  weekTitle: string;        // e.g., "2025|dec|w2"
  startDate: string;        // e.g., "2025-12-08"
  endDate: string;          // e.g., "2025-12-14"
  weekPlan: string;
  weekReality: string;
  pageId: string | null;
}

async function getWeekPlanningYear(year: number): Promise<WeekEntry[]>
async function updateWeekEntry(pageId: string, type: 'plan' | 'reality', content: string)
```

### Step 2: Backend - Add Week Planning API Endpoint
**File**: `app/api/week-planning/route.ts` (NEW)

```typescript
GET /api/week-planning?year=2025
  → Returns all week planning entries for the year

POST /api/week-planning/update
  → Updates week plan or week reality
  → Body: { pageId, type: 'plan'|'reality', content }
```

### Step 3: Frontend - Create WeekBlock Component
**File**: `components/WeekBlock.tsx` (NEW)

Props:
- weekTitle: string
- startDate: string
- endDate: string
- weekPlan: string
- weekReality: string
- onUpdate: (type: 'plan'|'reality', content: string) => Promise<void>

Features:
- Display week identifier (e.g., "Dec W2")
- Editable week plan textarea
- Editable week reality textarea
- Visual styling consistent with DayBlock

### Step 4: Frontend - Restructure YearView
**File**: `components/YearView.tsx`

Changes:
1. Fetch both Daily Ritual AND Week Planning data
2. Group days by week (Monday-Sunday)
3. Render rows as: [WeekBlock] + [7 DayBlocks]
4. Add week plan/reality update handler

New data structure:
```typescript
interface WeekRow {
  week: WeekEntry;
  days: DailyEntry[];  // 7 days
}
```

### Step 5: Update Styles
**File**: `app/globals.css` or inline Tailwind

- Week block styling (taller, different background)
- Row layout (flex or grid with 8 columns)
- Responsive adjustments

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer                                 │
├─────────────────────────────────────────────────────────────────┤
│  GET /api/daily-ritual?year=2025                                │
│    → Returns 365 daily entries                                   │
│                                                                  │
│  GET /api/week-planning?year=2025                               │
│    → Returns ~52 week entries                                    │
│                                                                  │
│  POST /api/week-planning/update                                 │
│    → Updates week plan/reality                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      YearView Component                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Fetch both daily + week data on mount                       │
│  2. Group days into weeks (by Start Date matching)              │
│  3. Render WeekRow for each week:                               │
│     [WeekBlock] [Day1] [Day2] [Day3] [Day4] [Day5] [Day6] [Day7]│
│  4. Handle updates for both daily and weekly entries            │
└─────────────────────────────────────────────────────────────────┘
```

## Week Matching Logic

The Week Planning database has `Start Date` and `End Date` properties. To match days to weeks:

```typescript
function findWeekForDate(date: string, weeks: WeekEntry[]): WeekEntry | null {
  return weeks.find(week =>
    date >= week.startDate && date <= week.endDate
  );
}
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `lib/notion.ts` | MODIFY | Add getWeekPlanningYear, updateWeekEntry |
| `app/api/week-planning/route.ts` | CREATE | GET endpoint for week data |
| `app/api/week-planning/update/route.ts` | CREATE | POST endpoint for updates |
| `components/WeekBlock.tsx` | CREATE | Week plan/reality display component |
| `components/YearView.tsx` | MODIFY | Restructure to week-based layout |

## Testing Checklist

- [ ] Week data loads correctly for all 52 weeks
- [ ] Days correctly grouped by week boundaries
- [ ] Week plan editable and saves to Notion
- [ ] Week reality editable and saves to Notion
- [ ] Responsive layout works on mobile
- [ ] Loading states show correctly
- [ ] Error handling for API failures

## Environment Variables
Already configured:
- `NOTION_WEEK_PLANNING_DB=242d6707-fb13-8054-b475-000bbd506a32`
