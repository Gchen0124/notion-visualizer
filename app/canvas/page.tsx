'use client';

import { useState, useEffect } from 'react';
import CanvasView from '@/components/canvas/CanvasView';
import { ConnectPage } from '@/components/connect';
import { PrivacyNotice } from '@/components/connect';
import { DemoModeBanner } from '@/components/onboarding';
import {
  loadConfig,
  clearConfig,
  getEffectiveApiKey,
  getTaskCalendarDataSourceId,
  getConnectionMethodName,
  NotionLocalConfig,
} from '@/lib/notion-config';
import { STORAGE_KEYS, exitDemoMode } from '@/lib/demo-config';

type AppMode = 'loading' | 'demo' | 'connect' | 'connected' | 'settings';

export default function CanvasPage() {
  const [config, setConfig] = useState<NotionLocalConfig | null>(null);
  const [mode, setMode] = useState<AppMode>('loading');
  const [showBanner, setShowBanner] = useState(true);

  // Load config on mount and check for OAuth callbacks
  useEffect(() => {
    // Ensure we're in the browser before accessing localStorage
    if (typeof window === 'undefined') return;

    // Check for OAuth callback - if present, automatically switch to connect mode
    // so that ConnectPage can process the callback
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    const hasOAuthSuccess = hash.includes('oauth_success=');
    const hasOAuthError = searchParams.get('oauth_error');

    if (hasOAuthSuccess || hasOAuthError) {
      console.log('[CanvasPage] OAuth callback detected, switching to connect mode');
      setMode('connect');
      return; // Don't check config yet, let ConnectPage handle the callback
    }

    try {
      const savedConfig = loadConfig();
      const isDemoMode = localStorage.getItem(STORAGE_KEYS.IS_DEMO_MODE) === 'true';

      if (savedConfig && !isDemoMode) {
        // User has connected their own database
        setConfig(savedConfig);
        setMode('connected');
      } else {
        // No config or in demo mode - show demo by default
        setMode('demo');
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setMode('demo'); // Fall back to demo on error
    }
  }, []);

  // Handle successful connection
  const handleConnected = (newConfig: NotionLocalConfig) => {
    exitDemoMode();
    setConfig(newConfig);
    setMode('connected');
  };

  // Handle disconnect
  const handleDisconnect = () => {
    clearConfig();
    setConfig(null);
    setMode('demo');
  };

  // Handle showing connect page
  const handleShowConnect = () => {
    setMode('connect');
  };

  // Handle back from connect page
  const handleBackFromConnect = () => {
    if (config) {
      setMode('connected');
    } else {
      setMode('demo');
    }
  };

  // Loading state
  if (mode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-gray-900 to-pink-900">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 mx-auto mb-4 text-purple-400"
            viewBox="0 0 24 24"
          >
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
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Connect page
  if (mode === 'connect') {
    return (
      <div className="relative">
        <button
          onClick={handleBackFromConnect}
          className="absolute top-4 left-4 z-10 px-4 py-2 bg-gray-700/80 text-white rounded-lg hover:bg-gray-600/80 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <ConnectPage onConnected={handleConnected} />
      </div>
    );
  }

  // Settings panel
  if (mode === 'settings' && config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-900 via-gray-900 to-pink-900">
        <div className="w-full max-w-md bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-gray-700">
          <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Connection Settings
          </h1>

          {/* Current connection info */}
          <div className="mb-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
            <h3 className="font-semibold text-white mb-3">Current Connection</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Method:</span>
                <span className="text-white">{getConnectionMethodName(config)}</span>
              </div>
              {config.connection.method === 'oauth' && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Workspace:</span>
                  <span className="text-white">{config.connection.workspaceName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Database:</span>
                <span className="text-white truncate ml-2">
                  {config.databases.taskCalendarDbName || config.databases.taskCalendarDbId.slice(0, 8) + '...'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Connected:</span>
                <span className="text-white">
                  {new Date(config.connectedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Privacy notice */}
          <PrivacyNotice variant="compact" className="mb-6" />

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => setMode('connected')}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
            >
              Back to Canvas
            </button>

            <button
              onClick={handleDisconnect}
              className="w-full px-6 py-3 bg-red-900/50 text-red-300 rounded-lg font-medium hover:bg-red-900/70 transition-all border border-red-700"
            >
              Disconnect
            </button>
          </div>

          {/* Info */}
          <p className="text-xs text-gray-500 mt-4 text-center">
            Disconnecting will clear all local data. You can reconnect anytime.
          </p>
        </div>
      </div>
    );
  }

  // Demo mode - use server-side demo credentials
  if (mode === 'demo') {
    return (
      <div className="relative">
        {showBanner && (
          <DemoModeBanner
            onConnectClick={handleShowConnect}
            onDismiss={() => setShowBanner(false)}
          />
        )}
        <div className={showBanner ? 'pt-12' : ''}>
          <DemoCanvasWrapper onShowSettings={handleShowConnect} />
        </div>
      </div>
    );
  }

  // Connected mode - user's own database
  const apiKey = getEffectiveApiKey(config!);
  const dataSourceId = getTaskCalendarDataSourceId(config!);
  const canvasViewDbId = config!.databases.canvasViewDbId;
  const taskCalendarDbId = config!.databases.taskCalendarDbId;

  return (
    <div className="relative">
      <CanvasView
        apiKey={apiKey}
        dataSourceId={dataSourceId}
        canvasViewDbId={canvasViewDbId}
        taskCalendarDbId={taskCalendarDbId}
        onShowSettings={() => setMode('settings')}
      />
    </div>
  );
}

// Wrapper component for demo mode that fetches demo credentials from server
function DemoCanvasWrapper({ onShowSettings }: { onShowSettings: () => void }) {
  const [demoCredentials, setDemoCredentials] = useState<{
    apiKey: string;
    databaseId: string;
    canvasViewDb?: string;
    defaultViewId?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDemoCredentials() {
      try {
        const response = await fetch('/api/demo-credentials');
        const data = await response.json();

        if (data.success) {
          setDemoCredentials({
            apiKey: data.apiKey,
            databaseId: data.databaseId,
            canvasViewDb: data.canvasViewDb,
            defaultViewId: data.defaultViewId,
          });
        } else {
          setError(data.error || 'Failed to load demo');
        }
      } catch (err) {
        setError('Failed to load demo credentials');
      }
    }

    fetchDemoCredentials();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-gray-900 to-pink-900 p-4">
        <div className="bg-gray-800/90 rounded-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-white mb-2">Demo Not Available</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={onShowSettings}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            Connect Your Own Database
          </button>
        </div>
      </div>
    );
  }

  if (!demoCredentials) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-gray-900 to-pink-900">
        <div className="text-white text-xl flex items-center gap-3">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading demo...
        </div>
      </div>
    );
  }

  return (
    <CanvasView
      apiKey={demoCredentials.apiKey}
      dataSourceId={demoCredentials.databaseId}
      canvasViewDbId={demoCredentials.canvasViewDb}
      onShowSettings={onShowSettings}
      defaultViewId={demoCredentials.defaultViewId}
      isDemoMode={true}
    />
  );
}
