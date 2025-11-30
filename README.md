# Daily Ritual - Notion Tracker

A mobile-friendly web app that displays your Daily Ritual from Notion in a beautiful 365-day grid view, showing Plan vs Reality for each day.

## Features

- **365-Day Grid View**: See your entire year at a glance
- **Plan vs Reality Tracking**: Track what you planned vs what actually happened
- **Two-Way Sync**: Edit directly in the app, changes sync to Notion
- **Mobile-Friendly**: Responsive design works great on phones and tablets
- **Statistics Dashboard**: See completion rates and progress
- **Year Selector**: Switch between different years

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Responsive styling
- **Notion SDK** - Direct database integration
- **Render.com** - Easy deployment

## Setup

### 1. Prerequisites

- Node.js 18+ installed
- Notion integration created (see below)
- Access to your Notion Daily Ritual database

### 2. Create Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "+ New integration"
3. Name it "Daily Ritual Tracker"
4. Copy the **Internal Integration Token**

### 3. Share Databases with Integration

**Important**: You must share all three databases with your integration:

1. Open each database in Notion:
   - Daily Ritual
   - Task Calendar
   - Week Planning
2. Click "..." (top right)
3. Click "Connections"
4. Select your integration

### 4. Environment Variables

Create `.env.local` file:

```env
NOTION_API_KEY=your_integration_token_here
NOTION_DAILY_RITUAL_DB=1edd6707fb13808ab331000c7ae1b2e5
NOTION_TASK_CALENDAR_DB=1eed6707fb1380e3adb6c6bccbde2cf5
NOTION_WEEK_PLANNING_DB=242d6707fb138052b18ccc80e1f678a9
```

### 5. Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Render.com

### Option 1: Auto Deploy (Recommended)

1. Push code to GitHub
2. Go to https://render.com
3. Click "New" → "Web Service"
4. Connect your GitHub repo
5. Render will detect `render.yaml` and configure automatically
6. Add environment variables in Render dashboard
7. Click "Create Web Service"

### Option 2: Manual Deploy

1. Go to https://render.com
2. Click "New" → "Web Service"
3. Choose "Deploy from GitHub" or "Public Git repository"
4. Configure:
   - **Name**: daily-ritual-notion
   - **Environment**: Node
   - **Region**: Oregon (or nearest)
   - **Branch**: main
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add environment variables
6. Click "Create Web Service"

### Environment Variables on Render

Add these in the Render dashboard (Environment tab):

```
NOTION_API_KEY=your_notion_api_token_here
NOTION_DAILY_RITUAL_DB=1edd6707fb13808ab331000c7ae1b2e5
NOTION_TASK_CALENDAR_DB=1eed6707fb1380e3adb6c6bccbde2cf5
NOTION_WEEK_PLANNING_DB=242d6707fb138052b18ccc80e1f678a9
```

## Database Schema

### Daily Ritual
- **Title**: Date (e.g., "2025/8/13")
- **Date on Daily RItual**: Date property
- **Daily Plan**: Text - what you plan to do
- **Daily Reality**: Text - what actually happened
- Plus many other tracking fields

### Task Calendar (Future Integration)
- Individual tasks with dates, status, priority
- Links to Weekly Planning

### Week Planning (Future Integration)
- Weekly goals and summaries
- Day-specific task breakdowns

See `DATABASE_SCHEMA.md` for complete documentation.

## Usage

### Viewing Your Year

- Grid shows all 365 days of the selected year
- Days with plan/reality show as white cards
- Empty days show as gray
- Complete days (plan + reality) have a green checkmark

### Editing Entries

1. Click the ✎ (edit) icon next to "Plan" or "Reality"
2. Type your content
3. Click "Save" - changes sync to Notion immediately
4. New entries are automatically created if they don't exist

### Mobile Usage

- Grid automatically adjusts for screen size
- 2 columns on phone, 7+ on desktop
- Touch-friendly edit buttons
- Responsive text sizing

## Troubleshooting

### "Could not find database" Error

**Solution**: Share the database with your integration:
1. Open database in Notion
2. Click "..." → "Connections" → Add your integration

### Data Not Loading

**Checks**:
1. Is `NOTION_API_KEY` correct?
2. Are databases shared with integration?
3. Check browser console for errors
4. Verify database IDs are correct

### Slow Loading

- First load fetches 365+ days from Notion
- Subsequent loads are faster (Next.js caching)
- Consider adding a loading indicator

## Future Enhancements

- [ ] Task Calendar integration
- [ ] Week Planning view
- [ ] Monthly summary view
- [ ] Export to CSV/PDF
- [ ] Offline mode with local caching
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] Bulk edit mode

## Contributing

This is a personal project, but feel free to fork and customize for your own use!

## License

ISC
