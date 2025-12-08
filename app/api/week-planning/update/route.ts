import { NextRequest, NextResponse } from 'next/server';
import { updateWeekEntry } from '@/lib/notion';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageId, type, content } = body;

    if (!pageId) {
      return NextResponse.json(
        { success: false, error: 'pageId is required' },
        { status: 400 }
      );
    }

    if (!type || !['plan', 'reality'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'type must be "plan" or "reality"' },
        { status: 400 }
      );
    }

    const result = await updateWeekEntry(pageId, type, content || '');

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update week entry',
      },
      { status: 500 }
    );
  }
}
