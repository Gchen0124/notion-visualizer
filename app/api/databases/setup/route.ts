import { NextRequest, NextResponse } from 'next/server';
import { setupDatabase, getDatabaseInfo, validateDatabaseSchema } from '@/lib/database-setup';

/**
 * Setup/validate a database for use with the canvas
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, databaseId, autoSetup = true } = body;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing apiKey' },
        { status: 400 }
      );
    }

    if (!databaseId) {
      return NextResponse.json(
        { success: false, error: 'Missing databaseId' },
        { status: 400 }
      );
    }

    if (autoSetup) {
      // Full setup: validate and add missing properties
      const result = await setupDatabase(apiKey, databaseId);
      return NextResponse.json(result);
    } else {
      // Just validate, don't modify
      const dbInfo = await getDatabaseInfo(apiKey, databaseId);
      const validation = validateDatabaseSchema(dbInfo);

      return NextResponse.json({
        success: true,
        database: dbInfo,
        validation,
      });
    }
  } catch (error: any) {
    console.error('[API /databases/setup] Error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
