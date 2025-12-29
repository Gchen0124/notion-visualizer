/**
 * Notion Configuration Manager
 *
 * Handles both OAuth and Manual connection methods.
 * All data is stored locally in the browser - we don't store any user data on our servers.
 */

// Required canvas properties that need to exist on the user's task database
export const REQUIRED_CANVAS_PROPERTIES = [
  { name: 'canvas_x', type: 'rich_text', description: 'X position on canvas' },
  { name: 'canvas_y', type: 'rich_text', description: 'Y position on canvas' },
  { name: 'canvas_width', type: 'rich_text', description: 'Node width' },
  { name: 'canvas_color', type: 'rich_text', description: 'Node background color' },
  { name: 'canvas_gradient_start', type: 'rich_text', description: 'Gradient start color' },
  { name: 'canvas_gradient_end', type: 'rich_text', description: 'Gradient end color' },
] as const;

// Connection method types
export type ConnectionMethod = 'oauth' | 'manual';

// OAuth-based configuration
export interface OAuthConfig {
  method: 'oauth';
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  workspaceId: string;
  workspaceName: string;
  botId: string;
}

// Manual configuration (existing method)
export interface ManualConfig {
  method: 'manual';
  apiKey: string;
}

// Database configuration (shared by both methods)
// For Notion API 2025-09-03, we need both databaseId and dataSourceId
export interface DatabaseConfig {
  taskCalendarDbId: string; // The database_id (for schema operations)
  taskCalendarDataSourceId?: string; // The data_source_id (for querying) - NEW
  taskCalendarDbName?: string;
  canvasViewDbId?: string;
  canvasViewDbName?: string;
}

// User preferences
export interface UserPreferences {
  canvasBgGradientStart: string;
  canvasBgGradientEnd: string;
}

// Complete local configuration
export interface NotionLocalConfig {
  connection: OAuthConfig | ManualConfig;
  databases: DatabaseConfig;
  preferences: UserPreferences;
  connectedAt: number;
  lastUsedAt: number;
}

const CONFIG_KEY = 'notion_visualizer_config';
const LEGACY_API_KEY = 'notion_api_key';
const LEGACY_DATA_SOURCE_ID = 'notion_data_source_id';

/**
 * Get the effective API key/token for making Notion API calls
 */
export function getEffectiveApiKey(config: NotionLocalConfig): string {
  if (config.connection.method === 'oauth') {
    return config.connection.accessToken;
  }
  return config.connection.apiKey;
}

/**
 * Get the task calendar database ID (for schema operations)
 */
export function getTaskCalendarDbId(config: NotionLocalConfig): string {
  return config.databases.taskCalendarDbId;
}

/**
 * Get the task calendar data source ID (for querying)
 * Falls back to taskCalendarDbId for backward compatibility
 */
export function getTaskCalendarDataSourceId(config: NotionLocalConfig): string {
  return config.databases.taskCalendarDataSourceId || config.databases.taskCalendarDbId;
}

/**
 * Save configuration to localStorage
 */
export function saveConfig(config: NotionLocalConfig): void {
  // Guard against server-side rendering
  if (typeof window === 'undefined') {
    return;
  }

  config.lastUsedAt = Date.now();
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

  // Also save in legacy format for backward compatibility with existing components
  const apiKey = getEffectiveApiKey(config);
  localStorage.setItem(LEGACY_API_KEY, apiKey);
  localStorage.setItem(LEGACY_DATA_SOURCE_ID, config.databases.taskCalendarDbId);
}

/**
 * Load configuration from localStorage
 */
export function loadConfig(): NotionLocalConfig | null {
  // Guard against server-side rendering
  if (typeof window === 'undefined') {
    return null;
  }

  // Try loading new format first
  const saved = localStorage.getItem(CONFIG_KEY);
  if (saved) {
    try {
      const config = JSON.parse(saved) as NotionLocalConfig;
      config.lastUsedAt = Date.now();
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      return config;
    } catch (e) {
      console.error('Failed to parse saved config:', e);
    }
  }

  // Try migrating from legacy format
  const legacyApiKey = localStorage.getItem(LEGACY_API_KEY);
  const legacyDataSourceId = localStorage.getItem(LEGACY_DATA_SOURCE_ID);

  if (legacyApiKey && legacyDataSourceId) {
    const migratedConfig: NotionLocalConfig = {
      connection: {
        method: 'manual',
        apiKey: legacyApiKey,
      },
      databases: {
        taskCalendarDbId: legacyDataSourceId,
      },
      preferences: {
        canvasBgGradientStart: localStorage.getItem('canvas_bg_gradient_start') || '#fff25c',
        canvasBgGradientEnd: localStorage.getItem('canvas_bg_gradient_end') || '#ffc7fa',
      },
      connectedAt: Date.now(),
      lastUsedAt: Date.now(),
    };

    // Save in new format
    saveConfig(migratedConfig);
    return migratedConfig;
  }

  return null;
}

/**
 * Clear all configuration (disconnect)
 */
export function clearConfig(): void {
  // Guard against server-side rendering
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(CONFIG_KEY);
  localStorage.removeItem(LEGACY_API_KEY);
  localStorage.removeItem(LEGACY_DATA_SOURCE_ID);
}

/**
 * Check if user is connected
 */
export function isConnected(): boolean {
  return loadConfig() !== null;
}

/**
 * Create a manual connection config
 */
export function createManualConfig(
  apiKey: string,
  taskCalendarDbId: string
): NotionLocalConfig {
  // Get preferences from localStorage (with SSR guard)
  const canvasBgGradientStart = typeof window !== 'undefined'
    ? localStorage.getItem('canvas_bg_gradient_start') || '#fff25c'
    : '#fff25c';
  const canvasBgGradientEnd = typeof window !== 'undefined'
    ? localStorage.getItem('canvas_bg_gradient_end') || '#ffc7fa'
    : '#ffc7fa';

  return {
    connection: {
      method: 'manual',
      apiKey,
    },
    databases: {
      taskCalendarDbId,
    },
    preferences: {
      canvasBgGradientStart,
      canvasBgGradientEnd,
    },
    connectedAt: Date.now(),
    lastUsedAt: Date.now(),
  };
}

/**
 * Create an OAuth connection config
 */
export function createOAuthConfig(
  accessToken: string,
  refreshToken: string | undefined,
  workspaceId: string,
  workspaceName: string,
  botId: string,
  taskCalendarDbId: string,
  taskCalendarDbName?: string
): NotionLocalConfig {
  // Get preferences from localStorage (with SSR guard)
  const canvasBgGradientStart = typeof window !== 'undefined'
    ? localStorage.getItem('canvas_bg_gradient_start') || '#fff25c'
    : '#fff25c';
  const canvasBgGradientEnd = typeof window !== 'undefined'
    ? localStorage.getItem('canvas_bg_gradient_end') || '#ffc7fa'
    : '#ffc7fa';

  return {
    connection: {
      method: 'oauth',
      accessToken,
      refreshToken,
      workspaceId,
      workspaceName,
      botId,
    },
    databases: {
      taskCalendarDbId,
      taskCalendarDbName,
    },
    preferences: {
      canvasBgGradientStart,
      canvasBgGradientEnd,
    },
    connectedAt: Date.now(),
    lastUsedAt: Date.now(),
  };
}

/**
 * Update database IDs in config
 */
export function updateDatabaseConfig(
  config: NotionLocalConfig,
  databases: Partial<DatabaseConfig>
): NotionLocalConfig {
  const updated = {
    ...config,
    databases: {
      ...config.databases,
      ...databases,
    },
  };
  saveConfig(updated);
  return updated;
}

/**
 * Update preferences in config
 */
export function updatePreferences(
  config: NotionLocalConfig,
  preferences: Partial<UserPreferences>
): NotionLocalConfig {
  const updated = {
    ...config,
    preferences: {
      ...config.preferences,
      ...preferences,
    },
  };
  saveConfig(updated);
  return updated;
}

/**
 * Get connection method display name
 */
export function getConnectionMethodName(config: NotionLocalConfig): string {
  return config.connection.method === 'oauth'
    ? 'Notion OAuth'
    : 'Manual Integration';
}

/**
 * Check if OAuth token needs refresh (if applicable)
 */
export function needsTokenRefresh(config: NotionLocalConfig): boolean {
  if (config.connection.method !== 'oauth') return false;
  if (!config.connection.tokenExpiresAt) return false;

  // Refresh if token expires in less than 5 minutes
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() > config.connection.tokenExpiresAt - fiveMinutes;
}
