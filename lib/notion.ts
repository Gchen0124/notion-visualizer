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
  CANVAS_VIEW: process.env.NOTION_CANVAS_VIEW_DB!,
};

export type TaskStatus = 'Not started' | 'In progress' | 'Complete' | 'Missing' | null;

export interface DailyEntry {
  date: string; // YYYY-MM-DD
  dayOfYear: number; // 1-365
  plan: string;
  reality: string;
  pageId: string | null;
  taskStatus1: TaskStatus;
  taskStatus2: TaskStatus;
  taskStatus3: TaskStatus;
}

export interface WeekEntry {
  weekTitle: string;      // e.g., "2025|dec|w2"
  startDate: string;      // e.g., "2025-12-08"
  endDate: string;        // e.g., "2025-12-14"
  weekPlan: string;
  weekReality: string;
  pageId: string | null;
}

export interface CanvasViewEntry {
  id: string;
  name: string;
  itemIds: string[];      // Task Calendar item IDs
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

      // Extract task status rollups
      const taskStatus1 = getRollupStatus(page, 'Task Status - Rollup (1)');
      const taskStatus2 = getRollupStatus(page, 'Task Status - Rollup (2)');
      const taskStatus3 = getRollupStatus(page, 'Task Status - Rollup (3)');

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
        taskStatus1,
        taskStatus2,
        taskStatus3,
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

export async function getWeekPlanningYear(year: number): Promise<WeekEntry[]> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  try {
    // Fetch weeks that overlap with the year
    // This catches cross-year weeks (e.g., Dec 29 - Jan 4)
    let allResults: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const response: any = await notion.dataSources.query({
        data_source_id: DATABASES.WEEK_PLANNING,
        filter: {
          and: [
            { property: 'Start Date', date: { on_or_before: yearEnd } },
            { property: 'End Date', date: { on_or_after: yearStart } }
          ]
        },
        sorts: [{ property: 'Start Date', direction: 'ascending' }],
        page_size: 100,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      });

      allResults = [...allResults, ...response.results];
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log(`Fetched ${allResults.length} weeks for year ${year}`);

    const weeks: WeekEntry[] = allResults.map((page: any) => {
      const weekTitle = getTitleProperty(page, 'Week');
      const startDate = page.properties['Start Date']?.date?.start || '';
      const endDate = page.properties['End Date']?.date?.start || '';
      const weekPlan = getTextProperty(page, 'week plan');
      const weekReality = getTextProperty(page, 'week reality');

      return {
        weekTitle,
        startDate,
        endDate,
        weekPlan,
        weekReality,
        pageId: page.id,
      };
    });

    // Filter out weeks without valid dates
    return weeks.filter(w => w.startDate && w.endDate);
  } catch (error) {
    console.error('Error fetching week planning data:', error);
    throw error;
  }
}

export async function updateWeekEntry(
  pageId: string,
  type: 'plan' | 'reality',
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const propertyName = type === 'plan' ? 'week plan' : 'week reality';

    await (notion as any).pages.update({
      page_id: pageId,
      properties: {
        [propertyName]: {
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

    return { success: true };
  } catch (error: any) {
    console.error('Error updating week entry:', error);
    return {
      success: false,
      error: error.message || 'Failed to update week entry',
    };
  }
}

// Canvas View functions
export async function getCanvasViews(): Promise<CanvasViewEntry[]> {
  try {
    const response: any = await notion.dataSources.query({
      data_source_id: DATABASES.CANVAS_VIEW,
      page_size: 100,
    });

    console.log(`Fetched ${response.results.length} canvas views from Notion`);

    const views: CanvasViewEntry[] = response.results.map((page: any) => {
      const name = page.properties['View Name']?.title?.[0]?.plain_text || '';
      const itemIds = (page.properties.items?.relation || []).map((r: any) => r.id);

      return {
        id: page.id,
        name,
        itemIds,
      };
    });

    return views.filter(v => v.name); // Filter out empty names
  } catch (error) {
    console.error('Error fetching canvas views:', error);
    throw error;
  }
}

export interface CanvasItemPosition {
  id: string;
  x: number;
  y: number;
  width?: number;
  color?: string;
  gradientStart?: string;
  gradientEnd?: string;
}

export async function saveCanvasView(
  name: string,
  itemIds: string[],
  existingViewId?: string,
  itemPositions?: CanvasItemPosition[]
): Promise<{ success: boolean; viewId?: string; error?: string }> {
  try {
    let viewId: string;

    // Step 1: Create or update the Canvas View page (only set View Name)
    // The 'items' relation is auto-populated via bidirectional sync when we update Task Calendar items
    if (existingViewId) {
      // Update existing view name
      await (notion as any).pages.update({
        page_id: existingViewId,
        properties: {
          'View Name': {
            title: [{ text: { content: name } }],
          },
        },
      });
      viewId = existingViewId;
      console.log(`Updated canvas view: ${name}`);
    } else {
      // Create new view with just the name
      const response: any = await notion.pages.create({
        parent: {
          type: 'data_source_id',
          data_source_id: DATABASES.CANVAS_VIEW,
        },
        properties: {
          'View Name': {
            title: [{ text: { content: name } }],
          },
        },
      });
      viewId = response.id;
      console.log(`Created canvas view: ${name} (id: ${viewId})`);
    }

    // Step 2: Update each Task Calendar item with position and Canvas View relation
    // This will auto-populate the 'items' property in Canvas View via bidirectional relation
    if (itemPositions && itemPositions.length > 0) {
      console.log(`Saving positions for ${itemPositions.length} items and linking to view...`);

      const updatePromises = itemPositions.map(async (item) => {
        try {
          const properties: any = {
            canvas_x: {
              rich_text: [{ text: { content: String(item.x) } }],
            },
            canvas_y: {
              rich_text: [{ text: { content: String(item.y) } }],
            },
            // Setting Canvas View on Task Calendar will auto-populate 'items' on Canvas View
            'Canvas View': {
              relation: [{ id: viewId }],
            },
          };

          // Add optional properties if provided
          if (item.width !== undefined) {
            properties.canvas_width = {
              rich_text: [{ text: { content: String(item.width) } }],
            };
          }
          if (item.color) {
            properties.canvas_color = {
              rich_text: [{ text: { content: item.color } }],
            };
          }
          if (item.gradientStart) {
            properties.canvas_gradient_start = {
              rich_text: [{ text: { content: item.gradientStart } }],
            };
          }
          if (item.gradientEnd) {
            properties.canvas_gradient_end = {
              rich_text: [{ text: { content: item.gradientEnd } }],
            };
          }

          await (notion as any).pages.update({
            page_id: item.id,
            properties,
          });

          console.log(`Saved position for item ${item.id}: (${item.x}, ${item.y}) linked to view ${viewId}`);
        } catch (err) {
          console.error(`Failed to save position for item ${item.id}:`, err);
        }
      });

      await Promise.all(updatePromises);
    }

    return { success: true, viewId };
  } catch (error: any) {
    console.error('Error saving canvas view:', error);
    return {
      success: false,
      error: error.message || 'Failed to save canvas view',
    };
  }
}

export async function deleteCanvasView(
  viewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Archive the page (Notion's way of "deleting")
    await (notion as any).pages.update({
      page_id: viewId,
      archived: true,
    });

    console.log(`Deleted canvas view: ${viewId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting canvas view:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete canvas view',
    };
  }
}

export interface CanvasViewWithItems {
  id: string;
  name: string;
  items: Array<{
    id: string;
    title: string;
    properties: Record<string, any>;
    canvas_x: number | null;
    canvas_y: number | null;
    canvas_width: number | null;
    canvas_color: string | null;
    canvas_gradient_start: string | null;
    canvas_gradient_end: string | null;
  }>;
}

export async function getCanvasViewWithItems(
  viewId: string
): Promise<{ success: boolean; view?: CanvasViewWithItems; error?: string }> {
  try {
    // 1. Fetch the view page to get its name and linked items
    const viewPage: any = await notion.pages.retrieve({
      page_id: viewId,
    });

    const viewName = viewPage.properties['View Name']?.title?.[0]?.plain_text || '';
    const linkedItemIds = (viewPage.properties.items?.relation || []).map((r: any) => r.id);

    console.log(`Fetched view "${viewName}" with ${linkedItemIds.length} linked items`);

    if (linkedItemIds.length === 0) {
      return {
        success: true,
        view: {
          id: viewId,
          name: viewName,
          items: [],
        },
      };
    }

    // 2. Fetch each linked Task Calendar item with their canvas positions
    const itemPromises = linkedItemIds.map(async (itemId: string) => {
      try {
        const page: any = await notion.pages.retrieve({
          page_id: itemId,
        });

        // Extract title (Task Plan is the title property)
        const titleProp = page.properties['Task Plan'];
        const title = titleProp?.title?.[0]?.plain_text || 'Untitled';

        // Extract canvas position properties
        const canvas_x = parseFloat(getTextProperty(page, 'canvas_x')) || null;
        const canvas_y = parseFloat(getTextProperty(page, 'canvas_y')) || null;
        const canvas_width = parseFloat(getTextProperty(page, 'canvas_width')) || null;
        const canvas_color = getTextProperty(page, 'canvas_color') || null;
        const canvas_gradient_start = getTextProperty(page, 'canvas_gradient_start') || null;
        const canvas_gradient_end = getTextProperty(page, 'canvas_gradient_end') || null;

        // Extract all properties for the item
        const properties: Record<string, any> = {};
        for (const [key, value] of Object.entries(page.properties)) {
          const prop = value as any;
          if (prop.type === 'title' && prop.title?.length > 0) {
            properties[key] = prop.title.map((t: any) => t.plain_text).join('');
          } else if (prop.type === 'rich_text' && prop.rich_text?.length > 0) {
            properties[key] = prop.rich_text.map((t: any) => t.plain_text).join('');
          } else if (prop.type === 'select' && prop.select) {
            properties[key] = prop.select.name;
          } else if (prop.type === 'status' && prop.status) {
            properties[key] = prop.status.name;
          } else if (prop.type === 'date' && prop.date) {
            properties[key] = prop.date.start;
          } else if (prop.type === 'relation' && prop.relation) {
            properties[key] = prop.relation.map((r: any) => r.id);
          } else if (prop.type === 'checkbox') {
            properties[key] = prop.checkbox;
          } else if (prop.type === 'number') {
            properties[key] = prop.number;
          }
        }

        // Also store canvas properties in the properties object
        properties.canvas_x = canvas_x;
        properties.canvas_y = canvas_y;
        properties.canvas_width = canvas_width;
        properties.canvas_color = canvas_color;
        properties.canvas_gradient_start = canvas_gradient_start;
        properties.canvas_gradient_end = canvas_gradient_end;

        return {
          id: itemId,
          title,
          properties,
          canvas_x,
          canvas_y,
          canvas_width,
          canvas_color,
          canvas_gradient_start,
          canvas_gradient_end,
        };
      } catch (err) {
        console.error(`Failed to fetch item ${itemId}:`, err);
        return null;
      }
    });

    const items = (await Promise.all(itemPromises)).filter(Boolean) as CanvasViewWithItems['items'];

    console.log(`Successfully fetched ${items.length} items with positions`);

    return {
      success: true,
      view: {
        id: viewId,
        name: viewName,
        items,
      },
    };
  } catch (error: any) {
    console.error('Error fetching canvas view with items:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch canvas view',
    };
  }
}

// Helper functions
function getTitleProperty(page: any, propertyName: string): string {
  if (!page) return '';
  const property = page.properties[propertyName];
  if (!property) return '';

  if (property.type === 'title' && property.title?.length > 0) {
    return property.title.map((t: any) => t.plain_text).join('');
  }

  return '';
}

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

function getRollupStatus(page: any, propertyName: string): TaskStatus {
  if (!page) return null;
  const property = page.properties[propertyName];
  if (!property) return null;

  // Rollup properties have type 'rollup' and contain an array of results
  if (property.type === 'rollup' && property.rollup) {
    const rollupArray = property.rollup.array;
    if (rollupArray && rollupArray.length > 0) {
      // Get the first status result from the rollup
      const firstResult = rollupArray[0];
      if (firstResult?.type === 'status' && firstResult.status?.name) {
        const statusName = firstResult.status.name;
        // Map to our TaskStatus type
        if (statusName === 'Not started') return 'Not started';
        if (statusName === 'In progress') return 'In progress';
        if (statusName === 'Complete' || statusName === 'Done') return 'Complete';
        if (statusName === 'Missing') return 'Missing';
      }
    }
  }

  return null;
}

// Keep the old function name as alias for backward compatibility
const getGoalStatus = getRollupStatus;
