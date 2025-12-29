import { NextRequest, NextResponse } from 'next/server';
import { listUserDatabases } from '@/lib/database-setup';

/**
 * List databases available to the user's integration
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey');

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'Missing apiKey' },
      { status: 400 }
    );
  }

  try {
    const databases = await listUserDatabases(apiKey);

    return NextResponse.json({
      success: true,
      databases,
    });
  } catch (error: any) {
    console.error('[API /databases/list] Error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
