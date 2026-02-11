import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

// Default Canvas View database data source ID (fallback for personal use)
const DEFAULT_CANVAS_VIEW_DB = process.env.NOTION_CANVAS_VIEW_DB || '2c4d6707-fb13-8003-bec8-000bd1af6172';
// Demo Canvas View database
const DEMO_CANVAS_VIEW_DB = process.env.DEMO_CANVAS_VIEW_DB || '2d7d6707-fb13-8198-a00c-000b360396c2';
// Demo API key for detecting demo mode
const DEMO_API_KEY = process.env.DEMO_NOTION_API_KEY;

// Relation property names in Task Calendar databases (on Task Calendar -> Canvas View)
const DEFAULT_CANVAS_VIEW_RELATION = 'Canvas View';
const DEMO_CANVAS_VIEW_RELATION = 'Canvas View (sample)';

// Relation property names in Canvas View databases (on Canvas View -> Task Calendar items)
const DEFAULT_ITEMS_RELATION = 'items';
const DEMO_ITEMS_RELATION = '✅ Task Calendar (sample)';

// Helper to get the correct canvas view DB based on the API key
function getCanvasViewDbId(apiKey: string): string {
  // If using demo API key, use demo canvas view DB
  if (DEMO_API_KEY && apiKey === DEMO_API_KEY) {
    return DEMO_CANVAS_VIEW_DB;
  }
  return DEFAULT_CANVAS_VIEW_DB;
}

// Helper to get the correct relation property name (Task Calendar -> Canvas View)
function getCanvasViewRelationName(apiKey: string): string {
  if (DEMO_API_KEY && apiKey === DEMO_API_KEY) {
    return DEMO_CANVAS_VIEW_RELATION;
  }
  return DEFAULT_CANVAS_VIEW_RELATION;
}

// Helper to get the correct items relation property name (Canvas View -> Task Calendar items)
function getItemsRelationName(apiKey: string): string {
  if (DEMO_API_KEY && apiKey === DEMO_API_KEY) {
    return DEMO_ITEMS_RELATION;
  }
  return DEFAULT_ITEMS_RELATION;
}

// GET - Fetch all canvas views from Notion, or a specific view with items
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const viewId = searchParams.get('viewId');
    // Allow overriding canvas view DB via query param (for flexibility)
    const canvasViewDbParam = searchParams.get('canvasViewDb');

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing apiKey' },
        { status: 400 }
      );
    }

    // If no canvasViewDb is provided and it's not a demo/personal API key,
    // return empty views (OAuth users without Canvas View DB set up)
    const isDemo = DEMO_API_KEY && apiKey === DEMO_API_KEY;
    const isPersonal = process.env.NOTION_API_KEY && apiKey === process.env.NOTION_API_KEY;

    if (!canvasViewDbParam && !isDemo && !isPersonal) {
      console.log('[canvas-views] No canvasViewDb provided for OAuth user, returning empty views');
      return NextResponse.json({ success: true, views: [], source: 'none' });
    }

    // Determine which canvas view DB to use
    // For demo mode, always use the demo canvas view DB (ignore any stale localStorage values)
    const canvasViewDbId = isDemo ? DEMO_CANVAS_VIEW_DB : (canvasViewDbParam || getCanvasViewDbId(apiKey));

    const notion = new Client({
      auth: apiKey,
      notionVersion: '2025-09-03',
    });

    // Get the correct items relation property name for this API key
    const itemsRelationName = getItemsRelationName(apiKey);

    if (viewId) {
      // Fetch specific view with all item details and positions
      const result = await getCanvasViewWithItems(notion, viewId, itemsRelationName);
      if (result.success) {
        return NextResponse.json({ success: true, view: result.view });
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        );
      }
    } else {
      // Fetch all views (list mode)
      try {
        const views = await getCanvasViews(notion, canvasViewDbId, itemsRelationName);
        return NextResponse.json({ success: true, views });
      } catch (dbError: any) {
        // If database not found, return empty views instead of error
        if (dbError.message?.includes('Could not find database') ||
            dbError.code === 'object_not_found') {
          console.log('[canvas-views] Canvas View database not found, returning empty views');
          return NextResponse.json({ success: true, views: [], source: 'none' });
        }
        throw dbError;
      }
    }
  } catch (error: any) {
    console.error('API Error fetching canvas views:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch canvas views',
      },
      { status: 500 }
    );
  }
}

// POST - Save a canvas view to Notion
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, name, itemIds, existingViewId, itemPositions, canvasViewDb, viewport } = body;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing apiKey' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'View name is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(itemIds)) {
      return NextResponse.json(
        { success: false, error: 'itemIds must be an array' },
        { status: 400 }
      );
    }

    // itemPositions is optional but should be an array if provided
    if (itemPositions && !Array.isArray(itemPositions)) {
      return NextResponse.json(
        { success: false, error: 'itemPositions must be an array' },
        { status: 400 }
      );
    }

    // Check if OAuth user without Canvas View DB
    const isDemo = DEMO_API_KEY && apiKey === DEMO_API_KEY;
    const isPersonal = process.env.NOTION_API_KEY && apiKey === process.env.NOTION_API_KEY;

    if (!canvasViewDb && !isDemo && !isPersonal) {
      // OAuth user trying to save without Canvas View DB - save locally only
      console.log('[canvas-views] OAuth user without canvasViewDb, returning local-only save');
      return NextResponse.json({
        success: true,
        viewId: null,
        source: 'local',
        message: 'Canvas View database not configured. View saved locally only.',
      });
    }

    // Determine which canvas view DB and relation property name to use
    const canvasViewDbId = canvasViewDb || getCanvasViewDbId(apiKey);
    const canvasViewRelationName = getCanvasViewRelationName(apiKey);

    const notion = new Client({
      auth: apiKey,
      notionVersion: '2025-09-03',
    });

    const result = await saveCanvasView(notion, name, itemIds, canvasViewDbId, canvasViewRelationName, existingViewId, itemPositions, viewport);

    if (result.success) {
      return NextResponse.json({
        success: true,
        viewId: result.viewId,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('API Error saving canvas view:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to save canvas view',
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete a canvas view from Notion
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const viewId = searchParams.get('viewId');

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing apiKey' },
        { status: 400 }
      );
    }

    if (!viewId) {
      return NextResponse.json(
        { success: false, error: 'viewId is required' },
        { status: 400 }
      );
    }

    const notion = new Client({
      auth: apiKey,
      notionVersion: '2025-09-03',
    });

    const result = await deleteCanvasView(notion, viewId);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('API Error deleting canvas view:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete canvas view',
      },
      { status: 500 }
    );
  }
}

// ==================== Helper Functions ====================

interface CanvasViewEntry {
  id: string;
  name: string;
  itemIds: string[];
  viewport?: CanvasViewport;
}

interface CanvasItemPosition {
  id: string;
  x: number;
  y: number;
  width?: number;
  color?: string;
  gradientStart?: string;
  gradientEnd?: string;
}

interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

// Fetch all canvas views
async function getCanvasViews(notion: Client, canvasViewDbId: string, itemsRelationName: string): Promise<CanvasViewEntry[]> {
  try {
    // For Notion API 2025-09-03, use dataSources.query with the ID
    // The ID can be either database_id or data_source_id format - Notion handles both
    console.log(`[getCanvasViews] Querying database: ${canvasViewDbId}`);

    const response: any = await (notion as any).dataSources.query({
      data_source_id: canvasViewDbId,
      page_size: 100,
    });

    console.log(`Fetched ${response.results.length} canvas views from Notion`);
    const effectiveItemsRelationName = resolveItemsRelationNameFromProperties(
      response.results?.[0]?.properties,
      itemsRelationName
    );
    console.log(`Using items relation property: "${effectiveItemsRelationName}"`);

    const views: CanvasViewEntry[] = response.results.map((page: any) => {
      const name = page.properties['View Name']?.title?.[0]?.plain_text || '';
      // Use dynamic property name for items relation
      const itemIds = (page.properties[effectiveItemsRelationName]?.relation || []).map((r: any) => r.id);

      // Extract viewport data from rich_text properties
      const viewportX = parseFloat(getTextPropertyFromPage(page, 'viewport_x')) || undefined;
      const viewportY = parseFloat(getTextPropertyFromPage(page, 'viewport_y')) || undefined;
      const viewportZoom = parseFloat(getTextPropertyFromPage(page, 'viewport_zoom')) || undefined;

      // Build viewport object if any values exist
      let viewport: CanvasViewport | undefined;
      if (viewportX !== undefined || viewportY !== undefined || viewportZoom !== undefined) {
        viewport = {
          x: viewportX ?? 0,
          y: viewportY ?? 0,
          zoom: viewportZoom ?? 1,
        };
      }

      console.log(`View "${name}" has ${itemIds.length} items, viewport:`, viewport);

      return {
        id: page.id,
        name,
        itemIds,
        viewport,
      };
    });

    return views.filter(v => v.name); // Filter out empty names
  } catch (error) {
    console.error('Error fetching canvas views:', error);
    throw error;
  }
}

// Helper to extract text property value from page object
function getTextPropertyFromPage(page: any, propertyName: string): string {
  if (!page) return '';
  const property = page.properties[propertyName];
  if (!property) return '';

  if (property.type === 'rich_text' && property.rich_text?.length > 0) {
    return property.rich_text.map((rt: any) => rt.plain_text).join('');
  }

  return '';
}

function resolveItemsRelationNameFromProperties(
  properties: Record<string, any> | undefined,
  preferredName: string
): string {
  if (!properties) return preferredName;
  if (properties[preferredName]?.type === 'relation') return preferredName;

  const relationNames = Object.entries(properties)
    .filter(([, prop]) => (prop as any)?.type === 'relation')
    .map(([name]) => name);

  if (relationNames.length === 0) return preferredName;

  const itemsCandidate = relationNames.find((name) => name.toLowerCase() === 'items');
  if (itemsCandidate) return itemsCandidate;

  const taskCandidate = relationNames.find((name) => {
    const lower = name.toLowerCase();
    return lower.includes('task') || lower.includes('item') || lower.includes('calendar');
  });
  if (taskCandidate) return taskCandidate;

  if (relationNames.length === 1) return relationNames[0];
  return preferredName;
}

async function resolveCanvasViewRelationNameOnTaskItem(
  notion: Client,
  itemId: string,
  preferredName: string
): Promise<string> {
  try {
    const itemPage: any = await notion.pages.retrieve({ page_id: itemId });
    const properties = itemPage.properties || {};

    if (properties[preferredName]?.type === 'relation') {
      return preferredName;
    }

    const relationNames = Object.entries(properties)
      .filter(([, prop]) => (prop as any)?.type === 'relation')
      .map(([name]) => name);

    if (relationNames.length === 0) return preferredName;

    const canvasCandidate = relationNames.find((name) => name.toLowerCase().includes('canvas'));
    if (canvasCandidate) return canvasCandidate;

    const viewCandidate = relationNames.find((name) => name.toLowerCase().includes('view'));
    if (viewCandidate) return viewCandidate;

    if (relationNames.length === 1) return relationNames[0];
    return preferredName;
  } catch (error) {
    console.warn('[saveCanvasView] Could not detect relation property on task item, using fallback:', preferredName);
    return preferredName;
  }
}

// Save a canvas view
async function saveCanvasView(
  notion: Client,
  name: string,
  itemIds: string[],
  canvasViewDbId: string,
  canvasViewRelationName: string,
  existingViewId?: string,
  itemPositions?: CanvasItemPosition[],
  viewport?: CanvasViewport
): Promise<{ success: boolean; viewId?: string; error?: string }> {
  try {
    let viewId: string;

    // Build view properties including viewport if provided
    const viewProperties: any = {
      'View Name': {
        title: [{ text: { content: name } }],
      },
    };

    // Add viewport properties if provided
    if (viewport) {
      viewProperties.viewport_x = {
        rich_text: [{ text: { content: String(viewport.x) } }],
      };
      viewProperties.viewport_y = {
        rich_text: [{ text: { content: String(viewport.y) } }],
      };
      viewProperties.viewport_zoom = {
        rich_text: [{ text: { content: String(viewport.zoom) } }],
      };
      console.log(`Saving viewport: x=${viewport.x}, y=${viewport.y}, zoom=${viewport.zoom}`);
    }

    // Step 1: Create or update the Canvas View page
    // The 'items' relation is auto-populated via bidirectional sync when we update Task Calendar items
    if (existingViewId) {
      // Update existing view
      await (notion as any).pages.update({
        page_id: existingViewId,
        properties: viewProperties,
      });
      viewId = existingViewId;
      console.log(`Updated canvas view: ${name}`);
    } else {
      // Create new view using data_source_id (Notion API 2025-09-03)
      console.log(`[saveCanvasView] Creating view in database: ${canvasViewDbId}`);

      const response: any = await notion.pages.create({
        parent: {
          type: 'data_source_id',
          data_source_id: canvasViewDbId,
        },
        properties: viewProperties,
      });
      viewId = response.id;
      console.log(`Created canvas view: ${name} (id: ${viewId})`);
    }

    // Step 2: Update each Task Calendar item with position and Canvas View relation
    // This will auto-populate the 'items' property in Canvas View via bidirectional relation
    if (itemPositions && itemPositions.length > 0) {
      const effectiveCanvasViewRelationName = await resolveCanvasViewRelationNameOnTaskItem(
        notion,
        itemPositions[0].id,
        canvasViewRelationName
      );

      console.log(`[saveCanvasView] Using Task Calendar relation property: "${effectiveCanvasViewRelationName}"`);
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
            // Use dynamic property name based on demo vs personal database
            [effectiveCanvasViewRelationName]: {
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
          return { success: true as const, itemId: item.id };
        } catch (err) {
          console.error(`Failed to save position for item ${item.id}:`, err);
          return { success: false as const, itemId: item.id, error: err };
        }
      });

      const updateResults = await Promise.all(updatePromises);
      const failedUpdates = updateResults.filter((r) => !r.success);

      if (failedUpdates.length === itemPositions.length) {
        return {
          success: false,
          error: `Failed to save positions for all ${itemPositions.length} items. Check Canvas View relation/property setup.`,
        };
      }

      if (failedUpdates.length > 0) {
        console.warn(`[saveCanvasView] Partial position save: ${failedUpdates.length}/${itemPositions.length} failed`);
      }
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

// Delete a canvas view
async function deleteCanvasView(
  notion: Client,
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

// Get a view with all its items and positions
async function getCanvasViewWithItems(
  notion: Client,
  viewId: string,
  itemsRelationName: string
): Promise<{ success: boolean; view?: any; error?: string }> {
  try {
    // 1. Fetch the view page to get its name and linked items
    const viewPage: any = await notion.pages.retrieve({
      page_id: viewId,
    });

    const viewName = viewPage.properties['View Name']?.title?.[0]?.plain_text || '';
    const effectiveItemsRelationName = resolveItemsRelationNameFromProperties(
      viewPage.properties,
      itemsRelationName
    );
    // Use dynamic property name for items relation
    const linkedItemIds = (viewPage.properties[effectiveItemsRelationName]?.relation || []).map((r: any) => r.id);

    // Extract viewport data from the view page
    const viewportX = parseFloat(getTextPropertyFromPage(viewPage, 'viewport_x')) || undefined;
    const viewportY = parseFloat(getTextPropertyFromPage(viewPage, 'viewport_y')) || undefined;
    const viewportZoom = parseFloat(getTextPropertyFromPage(viewPage, 'viewport_zoom')) || undefined;

    // Build viewport object if any values exist
    let viewport: CanvasViewport | undefined;
    if (viewportX !== undefined || viewportY !== undefined || viewportZoom !== undefined) {
      viewport = {
        x: viewportX ?? 0,
        y: viewportY ?? 0,
        zoom: viewportZoom ?? 1,
      };
    }

    console.log(`Fetched view "${viewName}" with ${linkedItemIds.length} linked items, viewport:`, viewport, `(using relation: "${effectiveItemsRelationName}")`);

    if (linkedItemIds.length === 0) {
      return {
        success: true,
        view: {
          id: viewId,
          name: viewName,
          items: [],
          viewport,
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
        // New: item dimensions from database
        const item_width = parseFloat(getTextProperty(page, 'item_width')) || null;
        const item_height = parseFloat(getTextProperty(page, 'item_height')) || null;

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
          } else if (prop.type === 'files' && prop.files) {
            // Handle files type (e.g., Canvas_Visual images)
            properties[key] = prop.files.map((f: any) => ({
              name: f.name,
              url: f.file?.url || f.external?.url || null,
              type: f.type,
            }));
          }
        }

        // Also store canvas properties in the properties object
        properties.canvas_x = canvas_x;
        properties.canvas_y = canvas_y;
        properties.canvas_width = canvas_width;
        properties.canvas_color = canvas_color;
        properties.canvas_gradient_start = canvas_gradient_start;
        properties.canvas_gradient_end = canvas_gradient_end;
        properties.item_width = item_width;
        properties.item_height = item_height;

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
          item_width,
          item_height,
        };
      } catch (err) {
        console.error(`Failed to fetch item ${itemId}:`, err);
        return null;
      }
    });

    const items = (await Promise.all(itemPromises)).filter(Boolean);

    console.log(`Successfully fetched ${items.length} items with positions, viewport:`, viewport);

    return {
      success: true,
      view: {
        id: viewId,
        name: viewName,
        items,
        viewport,
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

// Helper to extract text property value
function getTextProperty(page: any, propertyName: string): string {
  if (!page) return '';
  const property = page.properties[propertyName];
  if (!property) return '';

  if (property.type === 'rich_text' && property.rich_text.length > 0) {
    return property.rich_text.map((rt: any) => rt.plain_text).join('');
  }

  return '';
}
