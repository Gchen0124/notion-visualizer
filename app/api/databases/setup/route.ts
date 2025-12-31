import { NextRequest, NextResponse } from 'next/server';
import {
  setupDatabase,
  getDatabaseInfo,
  validateDatabaseSchema,
  createCanvasViewDatabase,
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

      // Check if main database has Canvas View relation and get the related database ID
      let canvasViewDbId: string | null = null;
      for (const [propName, prop] of Object.entries(dbInfo.properties)) {
        if (
          prop.type === 'relation' &&
          propName.toLowerCase().includes('canvas')
        ) {
          // Try to get the related database ID from the relation property
          // We need to fetch the full database schema to get this
          try {
            const { Client } = await import('@notionhq/client');
            const notion = new Client({ auth: apiKey });
            const fullDb: any = await notion.databases.retrieve({ database_id: databaseId });
            const relationProp = fullDb.properties[propName];
            if (relationProp?.relation?.database_id) {
              canvasViewDbId = relationProp.relation.database_id;
              console.log(`[API /databases/setup] Found Canvas View DB ID from relation: ${canvasViewDbId}`);
            }
          } catch (e) {
            console.warn('[API /databases/setup] Could not get relation database ID:', e);
          }
          break;
        }
      }

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
        return NextResponse.json({
          success: true,
          canvasViewDbId: createResult.databaseId,
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
