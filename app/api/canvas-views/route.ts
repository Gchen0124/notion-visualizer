import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

// Canvas View database data source ID (from the relation property in Task Calendar)
const CANVAS_VIEW_DATA_SOURCE_ID = '2c4d6707-fb13-8003-bec8-000bd1af6172';

// GET - Fetch all canvas views from Notion, or a specific view with items
export async function GET(request: NextRequest) {
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

    const notion = new Client({
      auth: apiKey,
      notionVersion: '2025-09-03',
    });

    if (viewId) {
      // Fetch specific view with all item details and positions
      const result = await getCanvasViewWithItems(notion, viewId);
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
      const views = await getCanvasViews(notion);
      return NextResponse.json({ success: true, views });
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
    const { apiKey, name, itemIds, existingViewId, itemPositions } = body;

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

    const notion = new Client({
      auth: apiKey,
      notionVersion: '2025-09-03',
    });

    const result = await saveCanvasView(notion, name, itemIds, existingViewId, itemPositions);

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

// Fetch all canvas views
async function getCanvasViews(notion: Client): Promise<CanvasViewEntry[]> {
  try {
    const response: any = await notion.dataSources.query({
      data_source_id: CANVAS_VIEW_DATA_SOURCE_ID,
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

// Save a canvas view
async function saveCanvasView(
  notion: Client,
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
          data_source_id: CANVAS_VIEW_DATA_SOURCE_ID,
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
  viewId: string
): Promise<{ success: boolean; view?: any; error?: string }> {
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

    const items = (await Promise.all(itemPromises)).filter(Boolean);

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
