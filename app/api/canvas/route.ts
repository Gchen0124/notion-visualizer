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
    const { apiKey, dataSourceId, action, itemId, properties } = body;

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
      const formattedProps = formatPropertiesForNotion(properties);
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
      console.log('[Canvas API] Updating page', itemId, 'with properties:', properties);

      // Update existing page
      await (notion as any).pages.update({
        page_id: itemId,
        properties: formatPropertiesForNotion(properties),
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error modifying item:', error);
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

    // Format based on schema type or auto-detect
    if (propType === 'title' || (typeof value === 'string' && (name.toLowerCase().includes('title') || name.toLowerCase().includes('name') || name === 'Task Plan'))) {
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
      // Could be relation or multi_select
      if (propType === 'relation') {
        formatted[name] = {
          relation: value.map((id) => ({ id })),
        };
      } else {
        formatted[name] = {
          multi_select: value.map((v) => ({ name: v })),
        };
      }
    }
  });

  return formatted;
}
