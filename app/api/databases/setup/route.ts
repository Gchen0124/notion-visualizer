import { NextRequest, NextResponse } from 'next/server';
import {
  setupDatabase,
  getDatabaseInfo,
  validateDatabaseSchema,
  createCanvasViewDatabase,
  findCanvasViewDatabaseId,
} from '@/lib/database-setup';

/**
 * Setup/validate a database for use with the canvas
 *
 * For Notion API 2025-09-03:
 * - databaseId: The parent database_id (for schema operations)
 * - dataSourceId: The data_source_id (for querying items)
 *
 * Options:
 * - autoSetup: true = full setup (default), false = just validate
 * - checkOnly: true = just check Canvas View status, don't create anything
 * - createCanvasViewDb: true = explicitly create Canvas View database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      apiKey,
      databaseId,
      dataSourceId,
      autoSetup = true,
      checkOnly = false,
      createCanvasViewDb = false,
    } = body;

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

    console.log(`[API /databases/setup] databaseId: ${databaseId}, dataSourceId: ${dataSourceId}, checkOnly: ${checkOnly}, createCanvasViewDb: ${createCanvasViewDb}`);

    // Check only mode - just verify if Canvas View database exists
    if (checkOnly) {
      const dbInfo = await getDatabaseInfo(apiKey, databaseId, dataSourceId);
      const canvasViewDbId = await findCanvasViewDatabaseId(apiKey, databaseId);

      return NextResponse.json({
        success: true,
        database: dbInfo,
        hasCanvasViewRelation: !!canvasViewDbId,
        canvasViewDbId,
      });
    }

    // Explicit Canvas View database creation
    if (createCanvasViewDb) {
      console.log('[API /databases/setup] Creating Canvas View database...');
      const createResult = await createCanvasViewDatabase(apiKey, databaseId);

      if (createResult.success && createResult.databaseId) {
        const canvasViewDbId = createResult.dataSourceId || createResult.databaseId;
        return NextResponse.json({
          success: true,
          canvasViewDbId,
          message: 'Canvas View database created successfully',
        });
      } else {
        return NextResponse.json({
          success: false,
          error: createResult.error || 'Failed to create Canvas View database',
        });
      }
    }

    if (autoSetup) {
      // Full setup: validate and add missing properties
      const result = await setupDatabase(apiKey, databaseId, dataSourceId);
      return NextResponse.json(result);
    } else {
      // Just validate, don't modify
      const dbInfo = await getDatabaseInfo(apiKey, databaseId, dataSourceId);
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
