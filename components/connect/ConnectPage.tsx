'use client';

import { useState, useEffect } from 'react';
import OAuthConnect from './OAuthConnect';
import ManualConnect from './ManualConnect';
import DatabasePicker from './DatabasePicker';
import PrivacyNotice from './PrivacyNotice';
import { isOAuthConfigured, verifyOAuthState } from '@/lib/oauth-config';
import {
  loadConfig,
  saveConfig,
  createManualConfig,
  createOAuthConfig,
  getEffectiveApiKey,
  NotionLocalConfig,
} from '@/lib/notion-config';
import { DatabaseInfo } from '@/lib/database-setup';

type ConnectionStep = 'choose' | 'oauth-callback' | 'manual' | 'pick-database' | 'setup' | 'connected';

interface ConnectPageProps {
  onConnected: (config: NotionLocalConfig) => void;
  existingConfig?: NotionLocalConfig | null;
}

export default function ConnectPage({ onConnected, existingConfig }: ConnectPageProps) {
  const [step, setStep] = useState<ConnectionStep>('choose');
  const [pendingApiKey, setPendingApiKey] = useState('');
  const [pendingOAuthData, setPendingOAuthData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [setupStatus, setSetupStatus] = useState('');

  const oauthConfigured = isOAuthConfigured();

  // Check for OAuth callback on mount
  useEffect(() => {
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);

    // Check for OAuth error
    const oauthError = searchParams.get('oauth_error');
    if (oauthError) {
      setError(`OAuth error: ${oauthError}`);
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    // Check for OAuth success in hash
    if (hash.includes('oauth_success=')) {
      const match = hash.match(/oauth_success=([^&]+)/);
      if (match) {
        try {
          const payload = JSON.parse(atob(match[1]));

          // Verify state if present
          if (payload.state && !verifyOAuthState(payload.state)) {
            setError('OAuth state mismatch. Please try again.');
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }

          console.log('[ConnectPage] OAuth callback received:', payload.workspace_name);

          setPendingOAuthData(payload);
          setPendingApiKey(payload.access_token);
          setStep('pick-database');

          // Clear the hash
          window.history.replaceState(null, '', window.location.pathname);
        } catch (e) {
          console.error('[ConnectPage] Failed to parse OAuth callback:', e);
          setError('Failed to process OAuth callback. Please try again.');
        }
      }
    }
  }, []);

  // Handle manual connection
  const handleManualConnect = async (apiKey: string, dataSourceId: string) => {
    setIsLoading(true);
    setError('');
    setSetupStatus('Validating connection...');

    try {
      // First, try to set up the database (validate and add missing properties)
      const setupResponse = await fetch('/api/databases/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          databaseId: dataSourceId,
          autoSetup: true,
        }),
      });

      const setupResult = await setupResponse.json();

      if (!setupResult.success) {
        throw new Error(setupResult.error || 'Failed to setup database');
      }

      setSetupStatus('Creating configuration...');

      // Create and save config
      const config = createManualConfig(apiKey, dataSourceId);

      // Add canvas view DB if created
      if (setupResult.canvasViewDbId) {
        config.databases.canvasViewDbId = setupResult.canvasViewDbId;
      }

      saveConfig(config);
      onConnected(config);
    } catch (err: any) {
      console.error('[ConnectPage] Manual connect error:', err);
      setError(err.message || 'Failed to connect');
    } finally {
      setIsLoading(false);
      setSetupStatus('');
    }
  };

  // Handle database selection (for OAuth flow)
  const handleDatabaseSelect = async (database: DatabaseInfo) => {
    setIsLoading(true);
    setError('');
    setSetupStatus('Setting up database...');

    try {
      console.log('[ConnectPage] Selected database:', {
        id: database.id,
        databaseId: database.databaseId,
        dataSourceId: database.dataSourceId,
        title: database.title,
      });

      // Set up the database - pass both IDs for Notion API 2025-09-03
      const setupResponse = await fetch('/api/databases/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: pendingApiKey,
          databaseId: database.databaseId, // For schema operations
          dataSourceId: database.dataSourceId, // For querying
          autoSetup: true,
        }),
      });

      const setupResult = await setupResponse.json();

      if (!setupResult.success) {
        throw new Error(setupResult.error || 'Failed to setup database');
      }

      setSetupStatus('Creating configuration...');

      // Create config based on connection type
      let config: NotionLocalConfig;

      if (pendingOAuthData) {
        config = createOAuthConfig(
          pendingOAuthData.access_token,
          pendingOAuthData.refresh_token,
          pendingOAuthData.workspace_id,
          pendingOAuthData.workspace_name,
          pendingOAuthData.bot_id,
          database.databaseId, // Store databaseId for schema
          database.title
        );
      } else {
        config = createManualConfig(pendingApiKey, database.databaseId);
        config.databases.taskCalendarDbName = database.title;
      }

      // Store the dataSourceId for querying (Notion API 2025-09-03)
      config.databases.taskCalendarDataSourceId = database.dataSourceId;

      // Add canvas view DB if created
      if (setupResult.canvasViewDbId) {
        config.databases.canvasViewDbId = setupResult.canvasViewDbId;
      }

      saveConfig(config);
      onConnected(config);
    } catch (err: any) {
      console.error('[ConnectPage] Database select error:', err);
      setError(err.message || 'Failed to setup database');
    } finally {
      setIsLoading(false);
      setSetupStatus('');
    }
  };

  // Render based on current step
  const renderStep = () => {
    switch (step) {
      case 'pick-database':
        return (
          <DatabasePicker
            apiKey={pendingApiKey}
            onSelect={handleDatabaseSelect}
            onCancel={() => {
              setPendingApiKey('');
              setPendingOAuthData(null);
              setStep('choose');
            }}
          />
        );

      case 'manual':
        return (
          <ManualConnect
            onConnect={handleManualConnect}
            onCancel={() => setStep('choose')}
            isLoading={isLoading}
          />
        );

      case 'choose':
      default:
        return (
          <div className="space-y-6">
            {/* OAuth Option */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                Recommended
              </h3>
              <OAuthConnect
                onNotConfigured={() => setStep('manual')}
              />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-400">or</span>
              </div>
            </div>

            {/* Manual Option */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                Advanced
              </h3>
              <button
                onClick={() => setStep('manual')}
                className="w-full px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-all border border-gray-600"
              >
                Connect with Integration Key
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Use your own internal Notion integration
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-900 via-gray-900 to-pink-900">
      <div className="w-full max-w-md bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-gray-700">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent text-center">
          Notion Visualizer
        </h1>
        <p className="text-gray-400 text-center mb-6">
          Connect your Notion database to visualize it on an interactive canvas
        </p>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
            <button
              onClick={() => setError('')}
              className="float-right text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
        )}

        {/* Setup status */}
        {setupStatus && (
          <div className="mb-4 p-3 bg-purple-900/50 border border-purple-700 rounded-lg text-purple-300 text-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
            {setupStatus}
          </div>
        )}

        {/* Main content */}
        {renderStep()}

        {/* Privacy notice */}
        <div className="mt-6">
          <PrivacyNotice variant="full" />
        </div>
      </div>
    </div>
  );
}
