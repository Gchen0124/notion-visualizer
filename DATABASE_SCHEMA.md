# Notion Database Architecture

## Overview
This app integrates with 3 Notion databases to create a comprehensive daily planning and tracking system.

---

## 1. Daily Ritual Database 🎑

**Database ID**: `1edd6707fb13808ab331000c7ae1b2e5`
**Collection ID**: `collection://1edd6707-fb13-8012-a386-000b3bfa7427`

### Purpose
Track daily plans vs reality for each day of the year.

### Key Properties

| Property Name | Type | Description |
|--------------|------|-------------|
| **Title** | title | Date format: "2025/7/27" or "\n2025/7/27\n" |
| **Daily Plan** | text | What you plan to do today |
| **Daily Reality** | text | What actually happened |
| Date on Daily RItual | date | Structured date property (2025-07-27) |
| 日主题to-dos | text | Daily theme/to-dos |
| Learn Check | select | Not started / In Progress / Complete |
| Output Check | select | Not started / In Progress / Complete |
| Opp Hunting Check | select | Not started / In Progress / Complete |
| moon | number | Moon phase tracking |
| overall health | text | Energy, water, exercise, etc. |
| bunny* fields | various | Pet tracking fields |
| 妈妈/爸爸 fields | text | Family tracking |

### Sample Entry
```
Title: 2025/7/27
Date on Daily RItual: 2025-07-27
Daily Plan: [empty in sample]
Daily Reality: [empty in sample]
日主题to-dos: 运营链路打通 ｜客服自动化打通
Learn Check: Not started
Output Check: Not started
Opp Hunting Check: Not started
```

---

## 2. Task Calendar Database ✅

**Database ID**: `1eed6707-fb13-80e3-adb6-c6bccbde2cf5`
**Collection ID**: `collection://1eed6707-fb13-80e7-b06e-000b4e2ed93c`

### Purpose
Individual tasks with scheduling, status tracking, and time logging.

### Key Properties

| Property Name | Type | Description |
|--------------|------|-------------|
| **Task Plan** | title | Task name/description |
| Status | status | Not Started / In Progress / Complete / Missing |
| Priority | select | High / Medium / Low |
| Old Calendar Period | date | Planned/scheduled date |
| Started At | date | When task was started |
| Completed At | date | When task was completed |
| Task Result & Documentation | text | Outcome and notes |
| Timer | select | Not Started / Running / Paused |
| cateogry | select | 📚input&learn / 🍊output&work / ♒️hunting opp / ❗️risk / 🎛️system / family / strategy |
| Time Spent | formula | Calculated time duration |
| Focus Duration(h) | formula | Focus time in hours |
| Goal 1/2/3 | relation | Links to goals |
| **week** | relation | Links to Week Planning |
| Parent item / Sub-item | relation | Task hierarchy |
| Blocked by / Blocking | relation | Task dependencies |

### Relations
- **→ Week Planning**: `week` property links tasks to weekly goals
- **→ Daily Ritual**: Indirectly via date alignment

---

## 3. Week Planning Database 📅

**Database ID**: `242d6707-fb13-8052-b18c-cc80e1f678a9`
**Collection ID**: `collection://242d6707-fb13-8054-b475-000bbd506a32`

### Purpose
Weekly goals, plans, and summaries organized by week.

### Key Properties

| Property Name | Type | Description |
|--------------|------|-------------|
| **Week** | title | Week identifier (e.g., "2025-08-13") |
| Start Date | date | Week start date |
| End Date | date | Week end date |
| Weekly Goals | text | Goals for the week |
| week reality | text | What actually happened this week |
| Monday Tasks | text | Planned tasks for Monday |
| Tuesday Tasks | text | Planned tasks for Tuesday |
| Wednesday Tasks | text | Planned tasks for Wednesday |
| Thursday Tasks | text | Planned tasks for Thursday |
| Friday Tasks | text | Planned tasks for Friday |
| Weekend Tasks | text | Planned tasks for weekend |
| #week | formula | Week number calculation |
| **✅ Task Calendar** | relation | Links to tasks scheduled this week |
| **🎑 Daily Ritual** | relation | Links to daily ritual entries |

### Relations
- **← Task Calendar**: Tasks link back via `week` property
- **→ Daily Ritual**: Links to daily entries for the week

---

## Database Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        Week Planning                            │
│  Week: "2025-08-13"                                             │
│  Start: 2025-08-13, End: 2025-08-19                            │
│  Weekly Goals: "Complete Q3 planning, Ship feature X"          │
│  week reality: "Good week, achieved most goals"                │
│  Monday/Tuesday/.../Weekend Tasks                               │
├─────────────────────────────────────────────────────────────────┤
│  Relations:                                                      │
│  ├─► ✅ Task Calendar (many tasks)                             │
│  └─► 🎑 Daily Ritual (7 daily entries)                         │
└─────────────────────────────────────────────────────────────────┘
                    ▲                           ▲
                    │                           │
                    │ (week)                    │ (date alignment)
                    │                           │
┌───────────────────┴──────────┐    ┌──────────┴──────────────────┐
│    Task Calendar              │    │    Daily Ritual             │
│  Task Plan: "Submit proposal" │    │  Title: "2025/8/13"         │
│  Status: In Progress          │    │  Date: 2025-08-13           │
│  Old Calendar Period: 2025-08│    │  Daily Plan: "..."          │
│  Priority: High               │    │  Daily Reality: "..."       │
│  Time Spent: 2.5h             │    │  日主题to-dos: "..."         │
│  week: → Week Planning        │    │  Learn Check: ✓             │
│  Goal 1/2/3: → Goals          │    │  Output Check: ✓            │
└───────────────────────────────┘    └─────────────────────────────┘
```

---

## Data Flow for Our App

### Primary View: 365-Day Grid (Daily Ritual)

**What we'll display:**
- For each day (1-365):
  - Day number/date
  - Daily Plan (from Daily Ritual)
  - Daily Reality (from Daily Ritual)
  - Completion indicator (Plan vs Reality comparison)

**Data fetching strategy:**
```typescript
// Fetch all Daily Ritual pages for the year
const dailyPages = await notion.databases.query({
  database_id: '1edd6707fb13808ab331000c7ae1b2e5',
  filter: {
    property: 'Date on Daily RItual',
    date: {
      on_or_after: '2025-01-01',
      on_or_before: '2025-12-31'
    }
  },
  sorts: [{ property: 'Date on Daily RItual', direction: 'ascending' }]
});

// Map to 365-day array
const yearData = Array.from({ length: 365 }, (_, i) => {
  const date = new Date(2025, 0, i + 1);
  const dateStr = formatDate(date); // "2025-01-01"
  const page = dailyPages.find(p => p.properties['Date on Daily RItual'].date?.start === dateStr);

  return {
    date: dateStr,
    dayOfYear: i + 1,
    plan: page?.properties['Daily Plan']?.rich_text?.[0]?.plain_text || '',
    reality: page?.properties['Daily Reality']?.rich_text?.[0]?.plain_text || '',
    pageId: page?.id || null
  };
});
```

### Secondary Views (Future)

**Task Calendar Integration:**
- Show tasks scheduled for each day
- Filter by `Old Calendar Period` date property

**Week Planning View:**
- Group days by week
- Show weekly goals and daily breakdown
- Aggregate completion stats

---

## API Endpoints (Next.js)

```
GET  /api/daily-ritual?year=2025
  → Fetch all daily ritual entries for year

POST /api/daily-ritual/update
  → Update Daily Plan or Daily Reality for a specific date
  → Creates page if doesn't exist

GET  /api/tasks?date=2025-08-13
  → Fetch tasks for specific date

GET  /api/week?week=2025-08-13
  → Fetch week planning data
```

---

## Environment Variables

```env
NOTION_API_KEY=your_notion_api_token_here
NOTION_DAILY_RITUAL_DB=1edd6707fb13808ab331000c7ae1b2e5
NOTION_TASK_CALENDAR_DB=1eed6707fb1380e3adb6c6bccbde2cf5
NOTION_WEEK_PLANNING_DB=242d6707fb138052b18ccc80e1f678a9
```

---

## Important Notes

1. **Daily Ritual Access**: Currently NOT shared with the integration. You need to:
   - Open Daily Ritual database in Notion
   - Click "..." → Connections → Add your integration

2. **Date Format Handling**:
   - Notion stores: `2025-07-27`
   - Page titles vary: `2025/7/27` or `\n2025/7/27\n`
   - Need normalization logic

3. **Empty Entries**:
   - Many days may not have pages yet
   - App should handle gracefully and allow creation

4. **Character Limits**:
   - Notion rich text blocks have ~2000 char limit
   - May need to split very long entries

5. **Rate Limits**:
   - Notion API: 3 requests/second
   - Batch queries when possible
   - Cache aggressively

---

## Next Steps

1. ✅ Schema mapped
2. ⏳ Build Next.js app structure
3. ⏳ Create API routes
4. ⏳ Build 365-day grid component
5. ⏳ Add edit functionality
6. ⏳ Deploy to Render.com
