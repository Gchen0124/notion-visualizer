import { NextRequest, NextResponse } from 'next/server';
import { updateDailyEntry } from '@/lib/notion';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, type, content } = body;

    if (!date || !type || content === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: date, type, content',
        },
        { status: 400 }
      );
    }

    if (type !== 'plan' && type !== 'reality') {
      return NextResponse.json(
        {
          success: false,
          error: 'Type must be either "plan" or "reality"',
        },
        { status: 400 }
      );
    }

    const result = await updateDailyEntry(date, type, content);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update entry',
      },
      { status: 500 }
    );
  }
}
