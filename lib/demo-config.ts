// Demo database configuration
// This sample database will be loaded for new users to explore the app

export const DEMO_CONFIG = {
  // These will be set via environment variables for security
  // The demo database is read-only and contains sample data
  API_KEY: process.env.DEMO_NOTION_API_KEY || process.env.NOTION_API_KEY || '',
  DATABASE_ID: process.env.DEMO_NOTION_DATABASE_ID || process.env.NOTION_TASK_CALENDAR_DB || '',
  CANVAS_VIEW_DB: process.env.DEMO_CANVAS_VIEW_DB || process.env.NOTION_CANVAS_VIEW_DB || '',
  DEFAULT_VIEW_ID: process.env.DEMO_DEFAULT_VIEW_ID || '',

  // Default view name to load on first visit
  DEFAULT_VIEW_NAME: 'Welcome Tour',
};

// Storage keys for onboarding state
export const STORAGE_KEYS = {
  NOTION_API_KEY: 'notion_api_key',
  DATABASE_ID: 'notion_data_source_id',
  HAS_SEEN_WELCOME: 'has_seen_welcome',
  IS_DEMO_MODE: 'is_demo_mode',
  TUTORIAL_STEP: 'tutorial_step',
  TUTORIAL_COMPLETE: 'tutorial_complete',
  ONBOARDING_COMPLETE: 'onboarding_complete',
};

// Tutorial steps for the guided tour
export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Notion Canvas!',
    description: 'This is a visual canvas where you can arrange and connect your Notion database items.',
    target: null, // No specific target, show in center
  },
  {
    id: 'add-items',
    title: 'Add Items to Canvas',
    description: 'Click the search icon to find and add items from your database.',
    target: '.toolbar-add-item',
  },
  {
    id: 'drag-items',
    title: 'Drag to Arrange',
    description: 'Drag cards around to organize them visually. Positions are saved automatically.',
    target: '.react-flow__node',
  },
  {
    id: 'connect-items',
    title: 'Create Connections',
    description: "Drag from one card's edge to another to create parent-child relationships.",
    target: '.react-flow__handle',
  },
  {
    id: 'save-view',
    title: 'Save Your View',
    description: 'Save your canvas layout as a view to reload it later.',
    target: '.toolbar-save-view',
  },
  {
    id: 'edit-properties',
    title: 'Edit Properties',
    description: 'Click on a card to edit its properties directly.',
    target: '.notion-node',
  },
];

// Check if user is in demo mode
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;

  // Check localStorage
  const hasOwnCredentials = localStorage.getItem(STORAGE_KEYS.NOTION_API_KEY);
  const isExplicitDemo = localStorage.getItem(STORAGE_KEYS.IS_DEMO_MODE) === 'true';

  return !hasOwnCredentials || isExplicitDemo;
}

// Check if user has completed onboarding
export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE) === 'true';
}

// Check if this is user's first visit
export function isFirstVisit(): boolean {
  if (typeof window === 'undefined') return true;
  return !localStorage.getItem(STORAGE_KEYS.HAS_SEEN_WELCOME);
}

// Mark welcome as seen
export function markWelcomeSeen(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.HAS_SEEN_WELCOME, 'true');
}

// Enter demo mode
export function enterDemoMode(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.IS_DEMO_MODE, 'true');
  // Clear any existing credentials when entering demo
  localStorage.removeItem(STORAGE_KEYS.NOTION_API_KEY);
  localStorage.removeItem(STORAGE_KEYS.DATABASE_ID);
}

// Exit demo mode (when user connects their own database)
export function exitDemoMode(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.IS_DEMO_MODE);
}
