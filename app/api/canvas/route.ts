import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

// GET: Fetch database items and schema
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const apiKey = searchParams.get('apiKey');
  const dataSourceId = searchParams.get('dataSourceId');

  console.log('[Canvas API] Received apiKey:', apiKey);
  console.log('[Canvas API] apiKey length:', apiKey?.length);
  console.log('[Canvas API] apiKey starts with:', apiKey?.substring(0, 10));
  console.log('[Canvas API] apiKey ends with:', apiKey?.substring(apiKey.length - 10));

  if (!apiKey || !dataSourceId) {
    return NextResponse.json(
      { error: 'Missing apiKey or dataSourceId' },
      { status: 400 }
    );
  }

  try {
    const notion = new Client({
      auth: apiKey,
      notionVersion: '2025-09-03',
    });

    // Fetch all pages from the database
    let allPages: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const response: any = await notion.dataSources.query({
        data_source_id: dataSourceId,
        page_size: 100,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      });

      allPages = [...allPages, ...response.results];
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    // Extract schema from first page
    const schema = allPages[0]?.properties
      ? Object.entries(allPages[0].properties).map(([name, prop]: [string, any]) => ({
          name,
          type: prop.type,
          id: prop.id,
        }))
      : [];

    // Transform pages to simpler format
    const items = allPages.map((page: any) => {
      const properties: any = {};
      Object.entries(page.properties).forEach(([name, prop]: [string, any]) => {
        properties[name] = extractPropertyValue(prop);
      });

      return {
        id: page.id,
        properties,
        url: page.url,
      };
    });

    return NextResponse.json({ items, schema });
  } catch (error: any) {
    console.error('Error fetching database:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch database' },
      { status: 500 }
    );
  }
}

// POST: Create new item or update existing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, dataSourceId, action, itemId, properties, schema } = body;

    if (!apiKey || !dataSourceId) {
      return NextResponse.json(
        { error: 'Missing apiKey or dataSourceId' },
        { status: 400 }
      );
    }

    const notion = new Client({
      auth: apiKey,
      notionVersion: '2025-09-03',
    });

    if (action === 'create') {
      console.log('[Canvas API] Creating page with properties:', properties);

      // Create new page
      const formattedProps = formatPropertiesForNotion(properties, schema);
      console.log('[Canvas API] Formatted properties:', JSON.stringify(formattedProps, null, 2));

      const newPage: any = await notion.pages.create({
        parent: {
          type: 'data_source_id',
          data_source_id: dataSourceId,
        },
        properties: formattedProps,
      });

      return NextResponse.json({ success: true, itemId: newPage.id });
    } else if (action === 'update') {
      console.log('[Canvas API] Updating page', itemId, 'with properties:', properties, 'schema:', schema);

      // Update existing page
      const formattedProps = formatPropertiesForNotion(properties, schema);
      console.log('[Canvas API] Formatted update properties:', JSON.stringify(formattedProps, null, 2));

      const result = await (notion as any).pages.update({
        page_id: itemId,
        properties: formattedProps,
      });

      console.log('[Canvas API] Update successful for page', itemId);

      return NextResponse.json({ success: true });
    } else if (action === 'delete') {
      console.log('[Canvas API] Deleting page', itemId);

      // Delete/archive the page
      await (notion as any).pages.update({
        page_id: itemId,
        archived: true,
      });

      console.log('[Canvas API] Delete successful for page', itemId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Canvas API] Error modifying item:', error);
    console.error('[Canvas API] Error details:', error.body || error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to modify item' },
      { status: 500 }
    );
  }
}

// Helper functions
function extractPropertyValue(property: any): any {
  switch (property.type) {
    case 'title':
      return property.title?.[0]?.plain_text || '';
    case 'rich_text':
      return property.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
    case 'number':
      return property.number;
    case 'select':
      return property.select?.name || '';
    case 'multi_select':
      return property.multi_select?.map((s: any) => s.name) || [];
    case 'date':
      return property.date?.start || '';
    case 'checkbox':
      return property.checkbox || false;
    case 'url':
      return property.url || '';
    case 'email':
      return property.email || '';
    case 'phone_number':
      return property.phone_number || '';
    case 'relation':
      return property.relation?.map((r: any) => r.id) || [];
    case 'people':
      return property.people?.map((p: any) => p.id) || [];
    case 'files':
      return property.files?.map((f: any) => f.name) || [];
    case 'status':
      return property.status?.name || '';
    default:
      return null;
  }
}

function formatPropertiesForNotion(properties: any, schema?: any[]): any {
  const formatted: any = {};

  Object.entries(properties).forEach(([name, value]: [string, any]) => {
    if (value === null || value === undefined) return;

    // Find property type from schema if available
    const schemaProp = schema?.find((s) => s.name === name);
    const propType = schemaProp?.type;

    // If property doesn't exist in schema, skip it (don't try to create new properties)
    if (schema && schema.length > 0 && !schemaProp) {
      console.log(`[formatPropertiesForNotion] Skipping property ${name} - not in schema`);
      return;
    }

    // Format based on schema type (if available) or auto-detect
    if (propType === 'title') {
      formatted[name] = {
        title: [{ text: { content: String(value) } }],
      };
    } else if (propType === 'rich_text') {
      // Convert any value to string for rich_text
      formatted[name] = {
        rich_text: [{ text: { content: String(value) } }],
      };
    } else if (propType === 'number') {
      formatted[name] = { number: typeof value === 'number' ? value : parseFloat(value) };
    } else if (propType === 'checkbox') {
      formatted[name] = { checkbox: Boolean(value) };
    } else if (propType === 'relation') {
      formatted[name] = {
        relation: Array.isArray(value) ? value.map((id) => ({ id })) : [],
      };
    } else if (propType === 'multi_select') {
      formatted[name] = {
        multi_select: Array.isArray(value) ? value.map((v) => ({ name: String(v) })) : [],
      };
    } else if (propType === 'select') {
      formatted[name] = { select: { name: String(value) } };
    } else if (propType === 'date') {
      formatted[name] = { date: { start: String(value) } };
    } else if (propType === 'url') {
      formatted[name] = { url: String(value) };
    } else if (propType === 'email') {
      formatted[name] = { email: String(value) };
    } else if (propType === 'phone_number') {
      formatted[name] = { phone_number: String(value) };
    } else {
      // Auto-detect if no schema available (fallback for create operations)
      if (typeof value === 'string' && (name.toLowerCase().includes('title') || name.toLowerCase().includes('name') || name === 'Task Plan')) {
        formatted[name] = {
          title: [{ text: { content: value } }],
        };
      } else if (typeof value === 'string') {
        formatted[name] = {
          rich_text: [{ text: { content: value } }],
        };
      } else if (typeof value === 'number') {
        formatted[name] = { number: value };
      } else if (typeof value === 'boolean') {
        formatted[name] = { checkbox: value };
      } else if (Array.isArray(value)) {
        formatted[name] = {
          multi_select: value.map((v) => ({ name: v })),
        };
      }
    }
  });

  return formatted;
}
