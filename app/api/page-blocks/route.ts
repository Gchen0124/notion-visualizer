import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

// GET: Fetch page blocks (content)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const apiKey = searchParams.get('apiKey');
  const pageId = searchParams.get('pageId');

  if (!apiKey || !pageId) {
    return NextResponse.json(
      { error: 'Missing apiKey or pageId' },
      { status: 400 }
    );
  }

  try {
    const notion = new Client({
      auth: apiKey,
      notionVersion: '2022-06-28', // blocks API works with this version
    });

    console.log('[Page Blocks API] Fetching blocks for page:', pageId);

    // Fetch all blocks from the page
    const blocks: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const response: any = await notion.blocks.children.list({
        block_id: pageId,
        page_size: 100,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      });

      blocks.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log('[Page Blocks API] Fetched', blocks.length, 'blocks');

    // Transform blocks to simpler format for editing
    const simplifiedBlocks = blocks.map((block: any) => ({
      id: block.id,
      type: block.type,
      content: extractBlockContent(block),
      hasChildren: block.has_children,
      editable: isEditableBlockType(block.type),
    }));

    console.log('[Page Blocks API] Returning', simplifiedBlocks.length, 'simplified blocks');

    return NextResponse.json({ success: true, blocks: simplifiedBlocks });
  } catch (error: any) {
    console.error('[Page Blocks API] Error fetching blocks:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch page blocks' },
      { status: 500 }
    );
  }
}

// POST: Update or create blocks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, pageId, action, blockId, blockType, content } = body;

    if (!apiKey || !pageId) {
      return NextResponse.json(
        { error: 'Missing apiKey or pageId' },
        { status: 400 }
      );
    }

    const notion = new Client({
      auth: apiKey,
      notionVersion: '2022-06-28',
    });

    console.log('[Page Blocks API] Action:', action, 'blockType:', blockType, 'content:', content?.substring(0, 50));

    if (action === 'update' && blockId) {
      // Update existing block - need to pass block data directly
      const blockData = createBlockData(blockType || 'paragraph', content);
      console.log('[Page Blocks API] Updating block:', blockId, 'with data:', JSON.stringify(blockData));

      await (notion as any).blocks.update({
        block_id: blockId,
        ...blockData,
      });

      console.log('[Page Blocks API] Block updated successfully');
      return NextResponse.json({ success: true });
    } else if (action === 'create') {
      // Create new block at the end of the page
      const blockData = createBlockDataForCreate(blockType || 'paragraph', content);
      console.log('[Page Blocks API] Creating block with data:', JSON.stringify(blockData));

      const response = await notion.blocks.children.append({
        block_id: pageId,
        children: [blockData as any],
      });

      const newBlockId = response.results[0]?.id;
      console.log('[Page Blocks API] Block created with ID:', newBlockId);
      return NextResponse.json({ success: true, blockId: newBlockId });
    } else if (action === 'delete' && blockId) {
      // Delete block
      console.log('[Page Blocks API] Deleting block:', blockId);
      await (notion as any).blocks.delete({
        block_id: blockId,
      });

      console.log('[Page Blocks API] Block deleted successfully');
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Page Blocks API] Error modifying block:', error);
    console.error('[Page Blocks API] Error details:', error.body || error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to modify block' },
      { status: 500 }
    );
  }
}

// Helper: Extract text content from a block
function extractBlockContent(block: any): string {
  const type = block.type;
  const blockData = block[type];

  if (!blockData) return '';

  // Handle rich_text based blocks
  if (blockData.rich_text) {
    return blockData.rich_text.map((rt: any) => rt.plain_text).join('');
  }

  // Handle specific block types
  switch (type) {
    case 'to_do':
      const checked = blockData.checked ? '[x]' : '[ ]';
      const todoText = blockData.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
      return `${checked} ${todoText}`;

    case 'code':
      const codeText = blockData.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
      const language = blockData.language || '';
      return `\`\`\`${language}\n${codeText}\n\`\`\``;

    case 'equation':
      return blockData.expression || '';

    case 'divider':
      return '---';

    case 'image':
    case 'video':
    case 'file':
    case 'pdf':
      const url = blockData.type === 'external'
        ? blockData.external?.url
        : blockData.file?.url;
      return `[${type}: ${url || 'no url'}]`;

    case 'bookmark':
    case 'embed':
    case 'link_preview':
      return blockData.url || '';

    case 'table_of_contents':
      return '[Table of Contents]';

    case 'breadcrumb':
      return '[Breadcrumb]';

    case 'column_list':
    case 'column':
      return '[Column layout - view in Notion]';

    case 'synced_block':
      return '[Synced block - view in Notion]';

    case 'template':
      return '[Template - view in Notion]';

    case 'link_to_page':
      return '[Link to page]';

    case 'child_page':
      return `[Child page: ${blockData.title || 'Untitled'}]`;

    case 'child_database':
      return `[Child database: ${blockData.title || 'Untitled'}]`;

    default:
      return '';
  }
}

// Helper: Check if block type is editable
function isEditableBlockType(type: string): boolean {
  const editableTypes = [
    'paragraph',
    'heading_1',
    'heading_2',
    'heading_3',
    'bulleted_list_item',
    'numbered_list_item',
    'quote',
    'callout',
    'toggle',
  ];
  return editableTypes.includes(type);
}

// Helper: Create block data for Notion API (for updates - no type wrapper needed)
function createBlockData(type: string, content: string): any {
  const richText = [
    {
      type: 'text',
      text: { content },
    },
  ];

  switch (type) {
    case 'paragraph':
      return { paragraph: { rich_text: richText } };
    case 'heading_1':
      return { heading_1: { rich_text: richText } };
    case 'heading_2':
      return { heading_2: { rich_text: richText } };
    case 'heading_3':
      return { heading_3: { rich_text: richText } };
    case 'bulleted_list_item':
      return { bulleted_list_item: { rich_text: richText } };
    case 'numbered_list_item':
      return { numbered_list_item: { rich_text: richText } };
    case 'quote':
      return { quote: { rich_text: richText } };
    case 'callout':
      return { callout: { rich_text: richText, icon: { emoji: '💡' } } };
    case 'toggle':
      return { toggle: { rich_text: richText } };
    default:
      return { paragraph: { rich_text: richText } };
  }
}

// Helper: Create block data for creation (needs object and type property)
function createBlockDataForCreate(type: string, content: string): any {
  const richText = [
    {
      type: 'text',
      text: { content },
    },
  ];

  const baseBlock = {
    object: 'block',
    type: type,
  };

  switch (type) {
    case 'paragraph':
      return { ...baseBlock, paragraph: { rich_text: richText } };
    case 'heading_1':
      return { ...baseBlock, heading_1: { rich_text: richText } };
    case 'heading_2':
      return { ...baseBlock, heading_2: { rich_text: richText } };
    case 'heading_3':
      return { ...baseBlock, heading_3: { rich_text: richText } };
    case 'bulleted_list_item':
      return { ...baseBlock, bulleted_list_item: { rich_text: richText } };
    case 'numbered_list_item':
      return { ...baseBlock, numbered_list_item: { rich_text: richText } };
    case 'quote':
      return { ...baseBlock, quote: { rich_text: richText } };
    case 'callout':
      return { ...baseBlock, callout: { rich_text: richText, icon: { emoji: '💡' } } };
    case 'toggle':
      return { ...baseBlock, toggle: { rich_text: richText } };
    default:
      return { ...baseBlock, type: 'paragraph', paragraph: { rich_text: richText } };
  }
}
