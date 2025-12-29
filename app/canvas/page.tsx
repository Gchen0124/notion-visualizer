'use client';

import { useState, useEffect } from 'react';
import CanvasView from '@/components/canvas/CanvasView';
import { ConnectPage } from '@/components/connect';
import { PrivacyNotice } from '@/components/connect';
import {
  loadConfig,
  clearConfig,
  getEffectiveApiKey,
  getTaskCalendarDbId,
  getConnectionMethodName,
  NotionLocalConfig,
} from '@/lib/notion-config';

export default function CanvasPage() {
  const [config, setConfig] = useState<NotionLocalConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Load config on mount
  useEffect(() => {
    const savedConfig = loadConfig();
    setConfig(savedConfig);
    setIsLoading(false);
  }, []);

  // Handle successful connection
  const handleConnected = (newConfig: NotionLocalConfig) => {
    setConfig(newConfig);
    setShowSettings(false);
  };

  // Handle disconnect
  const handleDisconnect = () => {
    clearConfig();
    setConfig(null);
    setShowSettings(false);
  };

  // Loading state
  if (isLoading) {
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

  // Not connected - show connect page
  if (!config) {
    return <ConnectPage onConnected={handleConnected} />;
  }

  // Settings panel
  if (showSettings) {
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
              onClick={() => setShowSettings(false)}
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

  // Connected - show canvas
  const apiKey = getEffectiveApiKey(config);
  const dataSourceId = getTaskCalendarDbId(config);

  return (
    <div className="relative">
      <CanvasView
        apiKey={apiKey}
        dataSourceId={dataSourceId}
        onShowSettings={() => setShowSettings(true)}
      />
    </div>
  );
}
