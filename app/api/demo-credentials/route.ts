import { NextResponse } from 'next/server';

// Demo credentials API endpoint
// Returns the demo database credentials from server-side environment variables
// This keeps the API key secure (never exposed to client-side code directly)

export async function GET() {
  const apiKey = process.env.DEMO_NOTION_API_KEY;
  const databaseId = process.env.DEMO_NOTION_DATABASE_ID;
  const canvasViewDb = process.env.DEMO_CANVAS_VIEW_DB;
  const defaultViewId = process.env.DEMO_DEFAULT_VIEW_ID;

  if (!apiKey || !databaseId) {
    // Fallback to main credentials if demo not configured
    const fallbackApiKey = process.env.NOTION_API_KEY;
    const fallbackDbId = process.env.NOTION_TASK_CALENDAR_DB;

    if (!fallbackApiKey || !fallbackDbId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Demo database not configured. Please connect your own Notion database.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      apiKey: fallbackApiKey,
      databaseId: fallbackDbId,
      canvasViewDb: process.env.NOTION_CANVAS_VIEW_DB || null,
      defaultViewId: null,
      isDemo: false,
    });
  }

  return NextResponse.json({
    success: true,
    apiKey,
    databaseId,
    canvasViewDb: canvasViewDb || null,
    defaultViewId: defaultViewId || null,
    isDemo: true,
  });
}
