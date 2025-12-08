import { NextRequest, NextResponse } from 'next/server';
import { getWeekPlanningYear } from '@/lib/notion';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get('year') || '2025');

  try {
    const data = await getWeekPlanningYear(year);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch week planning data',
      },
      { status: 500 }
    );
  }
}
