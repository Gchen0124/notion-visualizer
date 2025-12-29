/**
 * Database Setup Utilities
 *
 * Handles validation and auto-creation of required properties
 * for user's existing Notion databases.
 */

import { Client } from '@notionhq/client';
import { REQUIRED_CANVAS_PROPERTIES } from './notion-config';

export interface DatabaseInfo {
  id: string;
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
 * Fetch list of databases the user has shared with the integration
 */
export async function listUserDatabases(apiKey: string): Promise<DatabaseInfo[]> {
  const notion = new Client({ auth: apiKey });

  try {
    // Use type assertion to work around Notion SDK type issue with 'database' filter
    const response = await notion.search({
      filter: {
        property: 'object',
        value: 'database' as any,
      },
      page_size: 100,
    });

    return response.results
      .filter((result: any) => result.object === 'database')
      .map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Untitled',
        properties: Object.fromEntries(
          Object.entries(db.properties || {}).map(([name, prop]: [string, any]) => [
            name,
            { id: prop.id, name, type: prop.type },
          ])
        ),
      }));
  } catch (error: any) {
    console.error('[listUserDatabases] Error:', error.message);
    throw error;
  }
}

/**
 * Get detailed info about a specific database
 */
export async function getDatabaseInfo(
  apiKey: string,
  databaseId: string
): Promise<DatabaseInfo> {
  const notion = new Client({ auth: apiKey });

  try {
    const db: any = await notion.databases.retrieve({ database_id: databaseId });

    return {
      id: db.id,
      title: db.title?.[0]?.plain_text || 'Untitled',
      properties: Object.fromEntries(
        Object.entries(db.properties).map(([name, prop]: [string, any]) => [
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
): Promise<{ success: boolean; error?: string }> {
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
      return { success: true };
    }

    console.log(
      `[addMissingProperties] Adding ${Object.keys(propertiesToAdd).length} properties to database ${databaseId}`
    );

    // Type assertion needed for Notion SDK
    await (notion.databases as any).update({
      database_id: databaseId,
      properties: propertiesToAdd,
    });

    console.log('[addMissingProperties] Properties added successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[addMissingProperties] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create a Canvas View database with relation to Task Calendar
 */
export async function createCanvasViewDatabase(
  apiKey: string,
  taskCalendarDbId: string,
  parentPageId?: string
): Promise<{ success: boolean; databaseId?: string; error?: string }> {
  const notion = new Client({ auth: apiKey });

  try {
    // If no parent page provided, we need to find one
    // We'll create it as a child of the workspace (requires a page)
    let parentId = parentPageId;

    if (!parentId) {
      // Search for any page the user has shared
      const searchResponse = await notion.search({
        filter: { property: 'object', value: 'page' },
        page_size: 1,
      });

      if (searchResponse.results.length > 0) {
        parentId = searchResponse.results[0].id;
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

    // Create the Canvas View database with relation to Task Calendar
    // Type assertion needed for Notion SDK
    const response: any = await (notion.databases as any).create({
      parent: { type: 'page_id', page_id: parentId },
      title: [{ type: 'text', text: { content: 'Canvas Views' } }],
      properties: {
        'View Name': { title: {} },
        items: {
          relation: {
            database_id: taskCalendarDbId,
            type: 'dual_property',
            dual_property: {
              synced_property_name: 'Canvas View',
            },
          },
        },
      },
    });

    console.log(`[createCanvasViewDatabase] Created database: ${response.id}`);

    return { success: true, databaseId: response.id };
  } catch (error: any) {
    console.error('[createCanvasViewDatabase] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Full setup: validate database and add missing properties
 */
export async function setupDatabase(
  apiKey: string,
  taskCalendarDbId: string
): Promise<{
  success: boolean;
  validation?: ValidationResult;
  canvasViewDbId?: string;
  error?: string;
}> {
  try {
    // 1. Get database info
    const dbInfo = await getDatabaseInfo(apiKey, taskCalendarDbId);
    console.log(`[setupDatabase] Validating database: ${dbInfo.title}`);

    // 2. Validate schema
    const validation = validateDatabaseSchema(dbInfo);
    console.log(`[setupDatabase] Validation result:`, validation);

    // 3. Add missing properties if any
    if (validation.missingProperties.length > 0) {
      console.log(
        `[setupDatabase] Adding missing properties: ${validation.missingProperties.join(', ')}`
      );
      const addResult = await addMissingProperties(
        apiKey,
        taskCalendarDbId,
        validation.missingProperties
      );

      if (!addResult.success) {
        return { success: false, validation, error: addResult.error };
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
      const createResult = await createCanvasViewDatabase(apiKey, taskCalendarDbId);

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
        missingProperties: [],
      },
      canvasViewDbId,
    };
  } catch (error: any) {
    console.error('[setupDatabase] Error:', error.message);
    return { success: false, error: error.message };
  }
}
