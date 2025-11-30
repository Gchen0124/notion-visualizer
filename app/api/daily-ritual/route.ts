import { NextRequest, NextResponse } from 'next/server';
import { getDailyRitualYear } from '@/lib/notion';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get('year') || '2025');

  try {
    const data = await getDailyRitualYear(year);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch data',
      },
      { status: 500 }
    );
  }
}
