import { Client } from '@notionhq/client';

if (!process.env.NOTION_API_KEY) {
  throw new Error('NOTION_API_KEY is not defined');
}

export const notion = new Client({
  auth: process.env.NOTION_API_KEY,
  notionVersion: '2025-09-03',
});

export const DATABASES = {
  DAILY_RITUAL: process.env.NOTION_DAILY_RITUAL_DB!,
  TASK_CALENDAR: process.env.NOTION_TASK_CALENDAR_DB!,
  WEEK_PLANNING: process.env.NOTION_WEEK_PLANNING_DB!,
};

export interface DailyEntry {
  date: string; // YYYY-MM-DD
  dayOfYear: number; // 1-365
  plan: string;
  reality: string;
  pageId: string | null;
}

export async function getDailyRitualYear(year: number): Promise<DailyEntry[]> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  try {
    // Fetch all pages with pagination (no date filter - we'll filter client-side by title)
    let allResults: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const response: any = await notion.dataSources.query({
        data_source_id: DATABASES.DAILY_RITUAL,
        page_size: 100,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      });

      allResults = [...allResults, ...response.results];
      hasMore = response.has_more;
      startCursor = response.next_cursor;

      console.log(`Fetched ${response.results.length} pages (total so far: ${allResults.length}, has_more: ${hasMore})`);
    }

    console.log(`Total fetched: ${allResults.length} pages from Notion`);

    // Create a map for quick lookup
    const pageMap = new Map<string, any>();
    allResults.forEach((page: any) => {
      let dateStr = '';

      // 1. Try to get date from "Date on Daily RItual" property (Primary Source of Truth)
      const dateProperty = page.properties['Date on Daily RItual'];
      if (dateProperty?.date?.start) {
        dateStr = dateProperty.date.start;
        console.log(`Found date from property: ${dateStr}`);
      }
      // 2. Fallback: Parse date from title field "date（daily ritual object）"
      else {
        const titleProperty = page.properties['date（daily ritual object）'];
        if (titleProperty?.title?.[0]?.plain_text) {
          const rawTitle = titleProperty.title[0].plain_text;
          const titleText = rawTitle.trim();

          // Try to match YYYY-MM-DD format
          const dashMatch = titleText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dashMatch) {
            dateStr = titleText;
          } else {
            // Try old format: "2025/5/10" -> "2025-05-10"
            const slashMatch = titleText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
            if (slashMatch) {
              const [_, y, m, d] = slashMatch;
              dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }
        }
      }

      // Only include if we found a valid date and it's in the requested year
      if (dateStr && dateStr >= startDate && dateStr <= endDate) {
        pageMap.set(dateStr, page);
      }
    });

    console.log(`Created pageMap with ${pageMap.size} entries for year ${year}`);

    // Generate 365 days
    const daysInYear = isLeapYear(year) ? 366 : 365;
    const entries: DailyEntry[] = [];

    for (let day = 0; day < daysInYear; day++) {
      const date = new Date(year, 0, day + 1);
      const dateStr = formatDate(date);
      const page = pageMap.get(dateStr);

      const plan = getTextProperty(page, 'Daily Plan');
      const reality = getTextProperty(page, 'Daily Reality');

      // Debug: Log pages with reality data
      if (reality) {
        console.log(`Date ${dateStr} has reality data: "${reality.substring(0, 50)}..."`);
      }

      entries.push({
        date: dateStr,
        dayOfYear: day + 1,
        plan,
        reality,
        pageId: page?.id || null,
      });
    }

    return entries;
  } catch (error) {
    console.error('Error fetching daily ritual data:', error);
    throw error;
  }
}

export async function updateDailyEntry(
  date: string,
  type: 'plan' | 'reality',
  content: string
): Promise<{ success: boolean; pageId?: string; error?: string }> {
  try {
    console.log(`[updateDailyEntry] Updating ${date} type=${type} content="${content}"`);

    // Find existing page using the 'date' formula field
    // This formula field parses the date from the title, so it works for all pages
    console.log(`[updateDailyEntry] Searching for page with date ${date}...`);
    const response: any = await notion.dataSources.query({
      data_source_id: DATABASES.DAILY_RITUAL,
      filter: {
        property: 'date',
        date: {
          equals: date,
        },
      },
      page_size: 1,
    });

    console.log(`[updateDailyEntry] Found ${response.results.length} pages`);
    const existingPage = response.results[0];

    if (existingPage) {
      console.log(`[updateDailyEntry] Updating existing page ${existingPage.id}`);
      // Update existing page
      await (notion as any).pages.update({
        page_id: existingPage.id,
        properties: {
          [type === 'plan' ? 'Daily Plan' : 'Daily Reality']: {
            rich_text: [
              {
                text: {
                  content: content,
                },
              },
            ],
          },
        },
      });
      console.log(`[updateDailyEntry] Update successful`);

      return { success: true, pageId: existingPage.id };
    } else {
      // Create new page
      const newPage: any = await notion.pages.create({
        parent: {
          type: 'data_source_id',
          data_source_id: DATABASES.DAILY_RITUAL,
        },
        properties: {
          'date（daily ritual object）': {
            title: [
              {
                text: {
                  content: formatDateForTitle(date),
                },
              },
            ],
          },
          'Date on Daily RItual': {
            date: {
              start: date,
            },
          },
          [type === 'plan' ? 'Daily Plan' : 'Daily Reality']: {
            rich_text: [
              {
                text: {
                  content: content,
                },
              },
            ],
          },
        },
      });

      return { success: true, pageId: newPage.id };
    }
  } catch (error: any) {
    console.error('Error updating daily entry:', error);
    return {
      success: false,
      error: error.message || 'Failed to update entry',
    };
  }
}

// Helper functions
function getTextProperty(page: any, propertyName: string): string {
  if (!page) return '';
  const property = page.properties[propertyName];
  if (!property) return '';

  if (property.type === 'rich_text' && property.rich_text.length > 0) {
    return property.rich_text.map((rt: any) => rt.plain_text).join('');
  }

  if (property.type === 'text' && property.text.length > 0) {
    return property.text.map((t: any) => t.plain_text).join('');
  }

  return '';
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateForTitle(date: string): string {
  // Convert "2025-08-13" to "2025-08-13" (Keep as is, or ensure format)
  return date;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
