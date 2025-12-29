'use client';

import { useState } from 'react';

interface ManualConnectProps {
  onConnect: (apiKey: string, dataSourceId: string) => void;
  onCancel?: () => void;
  initialApiKey?: string;
  initialDataSourceId?: string;
  isLoading?: boolean;
}

export default function ManualConnect({
  onConnect,
  onCancel,
  initialApiKey = '',
  initialDataSourceId = '',
  isLoading = false,
}: ManualConnectProps) {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [dataSourceId, setDataSourceId] = useState(initialDataSourceId);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    setError('');
    const trimmedApiKey = apiKey.trim();
    const trimmedDataSourceId = dataSourceId.trim();

    if (!trimmedApiKey || !trimmedDataSourceId) {
      setError('Please enter both API key and Database ID');
      return;
    }

    // Validate API key format
    if (!trimmedApiKey.startsWith('secret_') && !trimmedApiKey.startsWith('ntn_')) {
      setError('Invalid API key format. It should start with "secret_" or "ntn_"');
      return;
    }

    // Validate Database ID format (UUID with or without dashes)
    const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedDataSourceId)) {
      setError(
        'Invalid Database ID format. It should be a UUID like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
      );
      return;
    }

    onConnect(trimmedApiKey, trimmedDataSourceId);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-white">
          Notion Integration Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="secret_xxxxx or ntn_xxxxx"
          className="w-full px-4 py-3 bg-gray-700/50 text-white placeholder-gray-400 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono text-sm border border-gray-600"
          autoComplete="off"
          disabled={isLoading}
        />
        <p className="text-xs text-gray-400 mt-1">
          Get from{' '}
          <a
            href="https://www.notion.so/my-integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:underline"
          >
            notion.so/my-integrations
          </a>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-white">
          Database ID
        </label>
        <input
          type="text"
          value={dataSourceId}
          onChange={(e) => setDataSourceId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="w-full px-4 py-3 bg-gray-700/50 text-white placeholder-gray-400 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all border border-gray-600"
          disabled={isLoading}
        />
        <p className="text-xs text-gray-400 mt-1">
          Found in your database URL after the workspace name
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="pt-2 space-y-2">
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
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
              Connecting...
            </span>
          ) : (
            'Connect Database'
          )}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-500 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="mt-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
        <h3 className="font-semibold text-sm mb-2 text-white">Setup Steps:</h3>
        <ol className="text-xs space-y-1 text-gray-300">
          <li>1. Go to notion.so/my-integrations</li>
          <li>2. Create a new integration (or use existing)</li>
          <li>3. Copy the "Internal Integration Secret"</li>
          <li>4. Open your Notion database</li>
          <li>5. Click ••• → Connections → Add your integration</li>
          <li>6. Copy the database ID from the URL</li>
        </ol>
      </div>
    </div>
  );
}
