import { Client } from '@notionhq/client';

if (!process.env.NOTION_API_KEY) {
  throw new Error('NOTION_API_KEY is not defined');
}

export const notion = new Client({
  auth: process.env.NOTION_API_KEY,
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

    // Create a map for quick lookup, parsing date from title field
    const pageMap = new Map<string, any>();
    allResults.forEach((page: any) => {
      // Parse date from title field: "date（daily ritual object）"
      const titleProperty = page.properties['date（daily ritual object）'];
      if (titleProperty?.title?.[0]?.plain_text) {
        const rawTitle = titleProperty.title[0].plain_text;
        const titleText = rawTitle.trim();
        console.log(`Processing title: "${rawTitle}" -> trimmed: "${titleText}"`);

        // Try to match YYYY-MM-DD format (new format like "2025-07-22")
        let dateStr = titleText;
        const dashMatch = titleText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dashMatch) {
          dateStr = titleText; // Already in correct format
          console.log(`Matched dash format: ${dateStr}`);
        } else {
          // Try old format: "2025/5/10" -> "2025-05-10"
          const slashMatch = titleText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
          if (slashMatch) {
            const [_, y, m, d] = slashMatch;
            dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            console.log(`Matched slash format: ${titleText} -> ${dateStr}`);
          } else {
            console.log(`No match for title: "${titleText}"`);
            return; // Skip if doesn't match either format
          }
        }

        // Only include if it's in the requested year
        if (dateStr >= startDate && dateStr <= endDate) {
          pageMap.set(dateStr, page);
          console.log(`Mapped: ${titleText} -> ${dateStr}`);
        } else {
          console.log(`Skipped ${dateStr} (not in ${startDate} to ${endDate})`);
        }
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
    // Find existing page
    const response: any = await notion.dataSources.query({
      data_source_id: DATABASES.DAILY_RITUAL,
      filter: {
        property: 'Date on Daily RItual',
        date: {
          equals: date,
        },
      },
      page_size: 1,
    });

    const existingPage = response.results[0];

    if (existingPage) {
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
  // Convert "2025-08-13" to "2025/8/13"
  const [year, month, day] = date.split('-');
  return `${year}/${parseInt(month)}/${parseInt(day)}`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
