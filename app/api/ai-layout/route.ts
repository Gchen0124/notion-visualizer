import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini - will use GEMINI_API_KEY from environment
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenerativeAI(apiKey);
};

interface CanvasItem {
  id: string;
  title: string;
  properties: Record<string, any>;
  currentPosition?: { x: number; y: number };
}

interface LayoutRequest {
  items: CanvasItem[];
  canvasSize: { width: number; height: number };
  userRequest: string;
  selectedProperties: string[];
}

interface LayoutItem {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  reasoning?: string;
}

interface LayoutOption {
  name: string;
  description: string;
  items: LayoutItem[];
}

interface LayoutResponse {
  layouts: LayoutOption[];
  insights?: string;
}

// POST: Generate AI-powered layout suggestions
export async function POST(request: NextRequest) {
  try {
    const body: LayoutRequest = await request.json();
    const { items, canvasSize, userRequest, selectedProperties } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided for layout' },
        { status: 400 }
      );
    }

    if (!userRequest) {
      return NextResponse.json(
        { error: 'No layout request provided' },
        { status: 400 }
      );
    }

    console.log('[AI Layout] Received request:', {
      itemCount: items.length,
      canvasSize,
      userRequest,
      selectedProperties,
    });

    // Build the prompt for Gemini
    const prompt = buildLayoutPrompt(items, canvasSize, userRequest, selectedProperties);

    // Call Gemini API
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('[AI Layout] Raw Gemini response:', text.substring(0, 500) + '...');

    // Parse the response
    const layoutResponse = parseGeminiResponse(text, items);

    console.log('[AI Layout] Parsed response:', {
      layoutCount: layoutResponse.layouts.length,
      insights: layoutResponse.insights?.substring(0, 100),
    });

    return NextResponse.json(layoutResponse);
  } catch (error: any) {
    console.error('[AI Layout] Error:', error);

    // Check for specific error types
    if (error.message?.includes('GEMINI_API_KEY')) {
      return NextResponse.json(
        { error: 'Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to generate layout' },
      { status: 500 }
    );
  }
}

function buildLayoutPrompt(
  items: CanvasItem[],
  canvasSize: { width: number; height: number },
  userRequest: string,
  selectedProperties: string[]
): string {
  // Prepare item data for the prompt
  const itemsData = items.map((item, index) => ({
    id: item.id,
    index: index + 1,
    title: item.title,
    properties: selectedProperties.reduce((acc, prop) => {
      if (item.properties[prop] !== undefined && item.properties[prop] !== null && item.properties[prop] !== '') {
        acc[prop] = item.properties[prop];
      }
      return acc;
    }, {} as Record<string, any>),
  }));

  const prompt = `You are an AI assistant that helps arrange items on a visual canvas. The user wants to organize their Notion items in a meaningful layout.

CANVAS SIZE: ${canvasSize.width}px width x ${canvasSize.height}px height

ITEMS TO ARRANGE (${items.length} items):
${JSON.stringify(itemsData, null, 2)}

USER REQUEST: "${userRequest}"

SELECTED PROPERTIES TO CONSIDER: ${selectedProperties.join(', ') || 'None specified - use your best judgment'}

INSTRUCTIONS:
1. Generate exactly 1 layout arrangement that best matches the user's request
2. Position items strategically based on their properties
3. Use the full canvas space effectively (items should be spread across 200-${canvasSize.width - 200}px horizontally and 100-${canvasSize.height - 100}px vertically)
4. Items should not overlap (minimum 50px spacing)
5. Default item size is 250px width x 150px height

RESPOND WITH ONLY VALID JSON in this exact format (no markdown, no code blocks, just raw JSON):
{
  "layouts": [
    {
      "name": "Layout Name",
      "description": "Brief description of the arrangement logic",
      "items": [
        {
          "id": "item-id-here",
          "x": 100,
          "y": 100,
          "width": 250,
          "reasoning": "Why this position"
        }
      ]
    }
  ],
  "insights": "Optional insight about the items and organization"
}

IMPORTANT:
- Return ONLY the JSON object, no other text
- Use the exact item IDs provided
- All coordinates must be positive numbers
- Ensure items are spread out and don't overlap`;

  return prompt;
}

function parseGeminiResponse(text: string, items: CanvasItem[]): LayoutResponse {
  try {
    // Try to extract JSON from the response
    let jsonStr = text.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    // Validate the response structure
    if (!parsed.layouts || !Array.isArray(parsed.layouts)) {
      throw new Error('Invalid response structure: missing layouts array');
    }

    // Ensure all items have valid IDs and positions
    parsed.layouts = parsed.layouts.map((layout: LayoutOption) => ({
      ...layout,
      items: layout.items.map((layoutItem: LayoutItem) => {
        // Find the original item to validate ID
        const originalItem = items.find(i => i.id === layoutItem.id);
        if (!originalItem) {
          console.warn(`[AI Layout] Unknown item ID: ${layoutItem.id}`);
        }
        return {
          id: layoutItem.id,
          x: Math.max(0, Math.round(layoutItem.x || 0)),
          y: Math.max(0, Math.round(layoutItem.y || 0)),
          width: layoutItem.width || 250,
          height: layoutItem.height || 150,
          color: layoutItem.color,
          reasoning: layoutItem.reasoning,
        };
      }),
    }));

    return parsed;
  } catch (parseError: any) {
    console.error('[AI Layout] Failed to parse Gemini response:', parseError);
    console.error('[AI Layout] Raw text:', text);

    // Return a fallback layout if parsing fails
    return generateFallbackLayout(items);
  }
}

function generateFallbackLayout(items: CanvasItem[]): LayoutResponse {
  // Generate a simple grid layout as fallback
  const columns = Math.ceil(Math.sqrt(items.length));
  const itemWidth = 250;
  const itemHeight = 150;
  const spacing = 50;
  const startX = 100;
  const startY = 100;

  const layoutItems: LayoutItem[] = items.map((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: item.id,
      x: startX + col * (itemWidth + spacing),
      y: startY + row * (itemHeight + spacing),
      width: itemWidth,
      height: itemHeight,
      reasoning: 'Fallback grid position',
    };
  });

  return {
    layouts: [
      {
        name: 'Grid Layout',
        description: 'Items arranged in a simple grid (AI response could not be parsed)',
        items: layoutItems,
      },
    ],
    insights: 'Using fallback grid layout due to AI response parsing error.',
  };
}
