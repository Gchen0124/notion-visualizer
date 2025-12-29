/**
 * OAuth Configuration
 *
 * For public integrations, you'll need to:
 * 1. Go to https://www.notion.so/my-integrations
 * 2. Create or select your integration
 * 3. Change type to "Public integration"
 * 4. Fill in required fields (company name, website, redirect URI, privacy policy, etc.)
 * 5. Copy the OAuth client ID and secret
 */

// These should be set in environment variables
export const OAUTH_CLIENT_ID = process.env.NEXT_PUBLIC_NOTION_OAUTH_CLIENT_ID || '';
export const OAUTH_CLIENT_SECRET = process.env.NOTION_OAUTH_CLIENT_SECRET || '';

// Redirect URI - must match what's configured in Notion
export const OAUTH_REDIRECT_URI =
  process.env.NEXT_PUBLIC_NOTION_OAUTH_REDIRECT_URI ||
  (typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/notion/callback`
    : '');

// Notion OAuth endpoints
export const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
export const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

/**
 * Check if OAuth is configured
 */
export function isOAuthConfigured(): boolean {
  return Boolean(OAUTH_CLIENT_ID);
}

/**
 * Generate the OAuth authorization URL
 */
export function getOAuthAuthorizationUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    response_type: 'code',
    owner: 'user',
    redirect_uri: OAUTH_REDIRECT_URI,
  });

  if (state) {
    params.set('state', state);
  }

  return `${NOTION_AUTH_URL}?${params.toString()}`;
}

/**
 * Generate a random state for CSRF protection
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store OAuth state for verification
 */
export function storeOAuthState(state: string): void {
  sessionStorage.setItem('notion_oauth_state', state);
}

/**
 * Verify and clear OAuth state
 */
export function verifyOAuthState(state: string): boolean {
  const storedState = sessionStorage.getItem('notion_oauth_state');
  sessionStorage.removeItem('notion_oauth_state');
  return storedState === state;
}
