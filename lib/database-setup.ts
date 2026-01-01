/**
 * Database Setup Utilities
 *
 * Handles validation and auto-creation of required properties
 * for user's existing Notion databases.
 *
 * Updated for Notion API version 2025-09-03 which introduced data_source concept.
 * See: https://developers.notion.com/docs/upgrade-guide-2025-09-03
 */

import { Client } from '@notionhq/client';
import { REQUIRED_CANVAS_PROPERTIES } from './notion-config';

export interface DatabaseInfo {
  id: string; // Primary ID (now the data_source_id for API 2025-09-03)
  databaseId: string; // The parent database_id (for schema operations)
  dataSourceId: string; // The data_source_id (for querying)
  title: string;
  properties: Record<string, PropertyInfo>;
}

export interface PropertyInfo {
  id: string;
  name: string;
  type: string;
}

export interface ValidationResult {
  isValid: boolean;
  missingProperties: string[];
  existingProperties: string[];
  canAutoCreate: boolean;
}

/**
 * Fetch list of databases/data sources the user has shared with the integration
 *
 * Notion API 2025-09-03 changes:
 * - Search filter now uses "data_source" instead of "database"
 * - Results include data_source objects with schema information
 */
export async function listUserDatabases(apiKey: string): Promise<DatabaseInfo[]> {
  const notion = new Client({ auth: apiKey });

  try {
    // Use the new "data_source" filter value (API 2025-09-03)
    const response = await notion.search({
      filter: {
        property: 'object',
        value: 'data_source',
      },
      page_size: 100,
    });

    console.log(`[listUserDatabases] Found ${response.results.length} data sources`);

    return response.results
      .filter((result: any) => result.object === 'data_source')
      .map((ds: any) => {
        // Extract both IDs correctly per Notion API 2025-09-03
        // data_source.id = data_source_id (used for dataSources.query())
        // data_source.parent.database_id = database_id (used for databases.update() for schema)
        const dataSourceId = ds.id;
        const databaseId = ds.parent?.database_id || ds.id;

        console.log(`[listUserDatabases] Data source: ${ds.title?.[0]?.plain_text || 'Untitled'}`);
        console.log(`  - dataSourceId: ${dataSourceId}`);
        console.log(`  - databaseId: ${databaseId}`);

        return {
          id: dataSourceId, // Primary ID is now the data_source_id
          databaseId, // Parent database_id for schema operations
          dataSourceId, // Explicit data_source_id for querying
          title: ds.title?.[0]?.plain_text || 'Untitled',
          properties: Object.fromEntries(
            Object.entries(ds.properties || {}).map(([name, prop]: [string, any]) => [
              name,
              { id: prop.id, name, type: prop.type },
            ])
          ),
        };
      });
  } catch (error: any) {
    console.error('[listUserDatabases] Error:', error.message);
    throw error;
  }
}

/**
 * Get detailed info about a specific database
 *
 * For Notion API 2025-09-03:
 * - Use database_id for databases.retrieve() to get schema
 * - The dataSourceId is for querying items
 */
export async function getDatabaseInfo(
  apiKey: string,
  databaseId: string,
  dataSourceId?: string
): Promise<DatabaseInfo> {
  const notion = new Client({ auth: apiKey });

  try {
    console.log(`[getDatabaseInfo] Retrieving database: ${databaseId}`);
    const db: any = await notion.databases.retrieve({ database_id: databaseId });

    return {
      id: dataSourceId || databaseId, // Use dataSourceId as primary if provided
      databaseId: db.id,
      dataSourceId: dataSourceId || db.id, // Use dataSourceId for querying
      title: db.title?.[0]?.plain_text || 'Untitled',
      properties: Object.fromEntries(
        Object.entries(db.properties || {}).map(([name, prop]: [string, any]) => [
          name,
          { id: prop.id, name, type: prop.type },
        ])
      ),
    };
  } catch (error: any) {
    console.error('[getDatabaseInfo] Error:', error.message);
    throw error;
  }
}

/**
 * Validate if a database has all required canvas properties
 */
export function validateDatabaseSchema(database: DatabaseInfo): ValidationResult {
  const existingPropertyNames = Object.keys(database.properties).map((name) =>
    name.toLowerCase()
  );

  const missingProperties: string[] = [];
  const existingProperties: string[] = [];

  for (const required of REQUIRED_CANVAS_PROPERTIES) {
    const exists = existingPropertyNames.includes(required.name.toLowerCase());
    if (exists) {
      existingProperties.push(required.name);
    } else {
      missingProperties.push(required.name);
    }
  }

  return {
    isValid: missingProperties.length === 0,
    missingProperties,
    existingProperties,
    canAutoCreate: true, // All our required properties are rich_text which can be auto-created
  };
}

/**
 * Add missing canvas properties to a database
 */
export async function addMissingProperties(
  apiKey: string,
  databaseId: string,
  missingProperties: string[]
): Promise<{ success: boolean; addedProperties?: string[]; skippedProperties?: string[]; error?: string }> {
  const notion = new Client({ auth: apiKey });

  try {
    // Build properties object for the update
    const propertiesToAdd: Record<string, any> = {};

    for (const propName of missingProperties) {
      const propDef = REQUIRED_CANVAS_PROPERTIES.find((p) => p.name === propName);
      if (propDef) {
        // All canvas properties are rich_text type
        propertiesToAdd[propName] = { rich_text: {} };
      }
    }

    if (Object.keys(propertiesToAdd).length === 0) {
      return { success: true, addedProperties: [], skippedProperties: [] };
    }

    console.log(
      `[addMissingProperties] Adding ${Object.keys(propertiesToAdd).length} properties to database ${databaseId}:`,
      Object.keys(propertiesToAdd)
    );

    // Type assertion needed for Notion SDK
    const updateResult = await (notion.databases as any).update({
      database_id: databaseId,
      properties: propertiesToAdd,
    });

    // Verify which properties were actually added by checking the response
    const addedProperties: string[] = [];
    const skippedProperties: string[] = [];

    for (const propName of Object.keys(propertiesToAdd)) {
      if (updateResult.properties && updateResult.properties[propName]) {
        addedProperties.push(propName);
      } else {
        skippedProperties.push(propName);
      }
    }

    console.log('[addMissingProperties] Properties added successfully:', addedProperties);
    if (skippedProperties.length > 0) {
      console.warn('[addMissingProperties] Some properties may not have been added:', skippedProperties);
    }

    return { success: true, addedProperties, skippedProperties };
  } catch (error: any) {
    console.error('[addMissingProperties] Error:', error.message);
    console.error('[addMissingProperties] Full error:', error);

    // Check if it's a permission error
    if (error.message?.includes('permission') || error.code === 'unauthorized') {
      return {
        success: false,
        error: 'Missing permission to modify database schema. Canvas position saving will be local-only.',
        skippedProperties: missingProperties
      };
    }

    return { success: false, error: error.message, skippedProperties: missingProperties };
  }
}

/**
 * Create a Canvas View database with relation to Task Calendar
 *
 * For Notion API 2025-09-03:
 * - databases.create returns a database object
 * - Relations need data_source_id instead of database_id
 * - Use single_property relation type for simpler setup (avoids dual_property issues)
 */
export async function createCanvasViewDatabase(
  apiKey: string,
  taskCalendarDbId: string,
  parentPageId?: string
): Promise<{ success: boolean; databaseId?: string; dataSourceId?: string; error?: string }> {
  const notion = new Client({ auth: apiKey });

  try {
    // If no parent page provided, we need to find one
    // We'll create it as a child of the workspace (requires a page)
    let parentId = parentPageId;

    if (!parentId) {
      // Search for any page the user has shared
      // Note: filter removed as Notion API changed - manually filter results
      const searchResponse = await notion.search({
        page_size: 20,
      });

      const pages = searchResponse.results.filter((r: any) => r.object === 'page');
      if (pages.length > 0) {
        parentId = pages[0].id;
      } else {
        // Try to use the task calendar's parent
        const taskDb: any = await notion.databases.retrieve({
          database_id: taskCalendarDbId,
        });
        if (taskDb.parent?.type === 'page_id') {
          parentId = taskDb.parent.page_id;
        } else if (taskDb.parent?.type === 'workspace') {
          // Can't create database directly in workspace without a page
          return {
            success: false,
            error:
              'Cannot auto-create Canvas View database. Please create it manually and link it.',
          };
        }
      }
    }

    if (!parentId) {
      return {
        success: false,
        error: 'No suitable parent page found for Canvas View database',
      };
    }

    console.log(`[createCanvasViewDatabase] Creating database under page ${parentId}`);
    console.log(`[createCanvasViewDatabase] Task Calendar DB ID: ${taskCalendarDbId}`);

    // Step 1: Create the database with basic properties first (without relation)
    // This avoids issues with dual_property relation in API 2025-09-03
    console.log('[createCanvasViewDatabase] Step 1: Creating database with basic properties...');
    const createResponse: any = await (notion.databases as any).create({
      parent: { type: 'page_id', page_id: parentId },
      title: [{ type: 'text', text: { content: 'Canvas Views' } }],
      properties: {
        'View Name': { title: {} },
        viewport_x: { rich_text: {} },
        viewport_y: { rich_text: {} },
        viewport_zoom: { rich_text: {} },
      },
    });

    const newDatabaseId = createResponse.id;
    console.log(`[createCanvasViewDatabase] Created database: ${newDatabaseId}`);
    console.log(`[createCanvasViewDatabase] Database properties:`, Object.keys(createResponse.properties || {}));

    // Step 2: Add the relation property separately
    // Use single_property type to avoid dual_property sync issues
    console.log('[createCanvasViewDatabase] Step 2: Adding relation property...');
    try {
      const updateResponse: any = await (notion.databases as any).update({
        database_id: newDatabaseId,
        properties: {
          items: {
            relation: {
              database_id: taskCalendarDbId,
              type: 'single_property',
              single_property: {},
            },
          },
        },
      });
      console.log(`[createCanvasViewDatabase] Added relation property. Final properties:`, Object.keys(updateResponse.properties || {}));
    } catch (relationError: any) {
      console.error('[createCanvasViewDatabase] Failed to add relation property:', relationError.message);
      // The database was created but relation failed - still usable for basic view saving
      console.warn('[createCanvasViewDatabase] Database created without relation. Views will work but items won\'t be linked.');
    }

    // Step 3: Get the data_source_id for the new database
    // In Notion API 2025-09-03, we need the data_source_id for queries
    let dataSourceId = newDatabaseId; // Fallback to database_id
    try {
      const searchResponse = await notion.search({
        filter: { property: 'object', value: 'data_source' },
        page_size: 50,
      });

      const matchingDs = searchResponse.results.find((ds: any) =>
        ds.parent?.database_id === newDatabaseId
      );

      if (matchingDs) {
        dataSourceId = matchingDs.id;
        console.log(`[createCanvasViewDatabase] Found data_source_id: ${dataSourceId}`);
      } else {
        console.log(`[createCanvasViewDatabase] No matching data_source found, using database_id: ${dataSourceId}`);
      }
    } catch (searchError: any) {
      console.warn('[createCanvasViewDatabase] Could not find data_source_id:', searchError.message);
    }

    return { success: true, databaseId: newDatabaseId, dataSourceId };
  } catch (error: any) {
    console.error('[createCanvasViewDatabase] Error:', error.message);
    console.error('[createCanvasViewDatabase] Full error:', JSON.stringify(error, null, 2));
    return { success: false, error: error.message };
  }
}

/**
 * Full setup: validate database and add missing properties
 *
 * For Notion API 2025-09-03:
 * - databaseId is used for databases.update() to add properties
 * - dataSourceId is used for querying and is returned for storage
 */
export async function setupDatabase(
  apiKey: string,
  databaseId: string,
  dataSourceId?: string
): Promise<{
  success: boolean;
  validation?: ValidationResult;
  canvasViewDbId?: string;
  databaseId?: string;
  dataSourceId?: string;
  error?: string;
  warning?: string;
}> {
  try {
    console.log(`[setupDatabase] Setting up database: ${databaseId}, dataSourceId: ${dataSourceId}`);

    // 1. Get database info using the database_id
    const dbInfo = await getDatabaseInfo(apiKey, databaseId, dataSourceId);
    console.log(`[setupDatabase] Validating database: ${dbInfo.title}`);

    // 2. Validate schema
    const validation = validateDatabaseSchema(dbInfo);
    console.log(`[setupDatabase] Validation result:`, validation);

    // 3. Add missing properties if any (uses database_id for update)
    // Note: This is non-fatal - if we can't add properties, user can still use the app with local-only positioning
    let propertyAdditionWarning: string | undefined;
    if (validation.missingProperties.length > 0) {
      console.log(
        `[setupDatabase] Adding missing properties: ${validation.missingProperties.join(', ')}`
      );
      const addResult = await addMissingProperties(
        apiKey,
        databaseId, // Use databaseId for schema updates
        validation.missingProperties
      );

      if (!addResult.success) {
        // Don't fail the entire setup - just warn and continue
        // The app can still work with local-only canvas positions
        console.warn('[setupDatabase] Could not add canvas properties:', addResult.error);
        console.warn('[setupDatabase] Canvas positions will be saved locally only');
        propertyAdditionWarning = addResult.error;
      } else if (addResult.skippedProperties && addResult.skippedProperties.length > 0) {
        console.warn('[setupDatabase] Some properties could not be added:', addResult.skippedProperties);
        propertyAdditionWarning = `Could not add: ${addResult.skippedProperties.join(', ')}`;
      }
    }

    // 4. Check if Canvas View relation already exists
    const hasCanvasViewRelation = Object.values(dbInfo.properties).some(
      (prop) =>
        prop.type === 'relation' &&
        prop.name.toLowerCase().includes('canvas')
    );

    let canvasViewDbId: string | undefined;

    if (!hasCanvasViewRelation) {
      console.log('[setupDatabase] Canvas View relation not found, creating database...');
      const createResult = await createCanvasViewDatabase(apiKey, databaseId);

      if (createResult.success && createResult.databaseId) {
        canvasViewDbId = createResult.databaseId;
      } else {
        // Non-fatal: user can still use the app without saved views
        console.warn(
          '[setupDatabase] Could not create Canvas View database:',
          createResult.error
        );
      }
    }

    return {
      success: true,
      validation: {
        ...validation,
        isValid: true,
        missingProperties: propertyAdditionWarning ? validation.missingProperties : [],
      },
      canvasViewDbId,
      databaseId: dbInfo.databaseId,
      dataSourceId: dbInfo.dataSourceId,
      warning: propertyAdditionWarning,
    };
  } catch (error: any) {
    console.error('[setupDatabase] Error:', error.message);
    return { success: false, error: error.message };
  }
}
