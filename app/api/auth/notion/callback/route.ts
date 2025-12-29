import { NextRequest, NextResponse } from 'next/server';

/**
 * OAuth Callback Route (Stateless)
 *
 * This route handles the OAuth callback from Notion.
 * It exchanges the authorization code for tokens and redirects back to the app.
 *
 * PRIVACY: This is a stateless endpoint - we don't store any user data.
 * Tokens are passed back to the client via URL hash (not logged by servers).
 */

const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.error('[OAuth Callback] Error from Notion:', error);
    return NextResponse.redirect(
      new URL(`/canvas?oauth_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  // Validate code exists
  if (!code) {
    console.error('[OAuth Callback] Missing authorization code');
    return NextResponse.redirect(
      new URL('/canvas?oauth_error=missing_code', request.url)
    );
  }

  // Get OAuth credentials from environment
  const clientId = process.env.NEXT_PUBLIC_NOTION_OAUTH_CLIENT_ID;
  const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.NEXT_PUBLIC_NOTION_OAUTH_REDIRECT_URI ||
    `${request.nextUrl.origin}/api/auth/notion/callback`;

  if (!clientId || !clientSecret) {
    console.error('[OAuth Callback] OAuth not configured - missing client ID or secret');
    return NextResponse.redirect(
      new URL('/canvas?oauth_error=not_configured', request.url)
    );
  }

  try {
    // Exchange code for tokens
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch(NOTION_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[OAuth Callback] Token exchange failed:', errorData);
      console.error('[OAuth Callback] Using redirect_uri:', redirectUri);
      console.error('[OAuth Callback] Client ID:', clientId);
      return NextResponse.redirect(
        new URL(`/canvas?oauth_error=token_exchange_failed&details=${encodeURIComponent(errorData)}`, request.url)
      );
    }

    const tokenData = await tokenResponse.json();

    console.log('[OAuth Callback] Token exchange successful for workspace:', tokenData.workspace_name);

    // Build the redirect URL with tokens in the hash (not query params)
    // Hash fragments are not sent to the server in subsequent requests
    const redirectUrl = new URL('/canvas', request.url);

    // Create a URL-safe JSON payload
    const payload = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      workspace_id: tokenData.workspace_id,
      workspace_name: tokenData.workspace_name,
      bot_id: tokenData.bot_id,
      duplicated_template_id: tokenData.duplicated_template_id,
      state,
    };

    // Encode the payload as base64 to make it URL-safe
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
    redirectUrl.hash = `oauth_success=${encodedPayload}`;

    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.error('[OAuth Callback] Error during token exchange:', err.message);
    return NextResponse.redirect(
      new URL(`/canvas?oauth_error=${encodeURIComponent(err.message)}`, request.url)
    );
  }
}
