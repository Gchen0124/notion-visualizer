'use client';

import { useState } from 'react';
import {
  isOAuthConfigured,
  getOAuthAuthorizationUrl,
  generateOAuthState,
  storeOAuthState,
} from '@/lib/oauth-config';

interface OAuthConnectProps {
  onNotConfigured?: () => void;
}

export default function OAuthConnect({ onNotConfigured }: OAuthConnectProps) {
  const [isLoading, setIsLoading] = useState(false);

  const oauthConfigured = isOAuthConfigured();

  const handleOAuthConnect = () => {
    if (!oauthConfigured) {
      onNotConfigured?.();
      return;
    }

    setIsLoading(true);

    // Generate and store state for CSRF protection
    const state = generateOAuthState();
    storeOAuthState(state);

    // Redirect to Notion OAuth
    const authUrl = getOAuthAuthorizationUrl(state);
    window.location.href = authUrl;
  };

  if (!oauthConfigured) {
    return (
      <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="font-semibold text-yellow-300 text-sm">OAuth Not Configured</h3>
            <p className="text-xs text-gray-400 mt-1">
              One-click connection is not available yet. Please use the manual connection method below.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleOAuthConnect}
        disabled={isLoading}
        className="w-full px-6 py-4 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 shadow-lg"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Redirecting to Notion...
          </span>
        ) : (
          <>
            {/* Notion Logo */}
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
              <path
                d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z"
                fill="#fff"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M61.35.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257-3.89c5.433-.387 6.99-2.917 6.99-7.193V20.64c0-2.21-.873-2.847-3.443-4.733L74.167 3.143C69.893-.063 68.147-.457 61.35.227zM25.505 28.79c-5.74.354-7.038.43-10.307-2.31L6.663 19.747c-.83-.78-1.213-1.36-1.213-2.14 0-.78.393-1.56 2.33-1.757l54.543-4.067c4.077-.39 6.217 1.167 7.83 2.527l10.503 7.627c.403.293.903.877.903 1.757l-.097 66.023c0 1.167-.52 1.947-1.917 2.043l-61.443 3.693c-1.99.1-2.913-.58-3.913-1.853l-9.603-12.423c-.5-.78-.903-1.95-.903-3.117V30.2c0-1.25.5-2.14 2.33-2.33l19.493-1.08v2z"
                fill="#000"
              />
              <path
                d="M28.7 35.267c0-1.557.877-2.333 2.14-2.43l40.25-2.04c1.263-.097 1.75.68 1.75 1.653v44.94c0 1.557-.877 2.333-2.14 2.43l-40.25 2.04c-1.263.097-1.75-.68-1.75-1.653V35.267z"
                fill="#000"
              />
              <path
                d="M67.557 41.31c.193.873 0 1.75-.877 1.847l-1.946.39v32.573c-1.703.877-3.3 1.363-4.613 1.363-2.14 0-2.687-.68-4.283-2.723L42.057 53.32v20.09l4.08.877s0 1.75-2.433 1.75l-6.707.39c-.193-.39 0-1.363.68-1.557l1.75-.487V47.63l-2.43-.193c-.193-.877.29-2.14 1.653-2.237l7.193-.487 14.58 22.31V48.7l-3.427-.39c-.193-1.07.583-1.847 1.557-1.94l6.997-.39.007-.67z"
                fill="#fff"
              />
            </svg>
            <span>Connect with Notion</span>
          </>
        )}
      </button>

      <p className="text-xs text-gray-400 text-center">
        You'll be redirected to Notion to authorize access to your databases
      </p>
    </div>
  );
}
