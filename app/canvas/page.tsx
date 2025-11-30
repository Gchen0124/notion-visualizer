'use client';

import { useState, useEffect } from 'react';
import CanvasView from '@/components/canvas/CanvasView';

export default function CanvasPage() {
  const [apiKey, setApiKey] = useState('');
  const [dataSourceId, setDataSourceId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

  // Load credentials from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem('notion_api_key');
    const savedDataSourceId = localStorage.getItem('notion_data_source_id');

    if (savedApiKey && savedDataSourceId) {
      setApiKey(savedApiKey);
      setDataSourceId(savedDataSourceId);
      setIsConnected(true);
    } else {
      setShowCredentials(true);
    }
  }, []);

  const handleConnect = () => {
    const trimmedApiKey = apiKey.trim();
    const trimmedDataSourceId = dataSourceId.trim();

    if (!trimmedApiKey || !trimmedDataSourceId) {
      alert('Please enter both API key and Data Source ID');
      return;
    }

    console.log('[Canvas Page] Saving apiKey:', trimmedApiKey);
    console.log('[Canvas Page] apiKey length:', trimmedApiKey.length);

    localStorage.setItem('notion_api_key', trimmedApiKey);
    localStorage.setItem('notion_data_source_id', trimmedDataSourceId);
    setApiKey(trimmedApiKey);
    setDataSourceId(trimmedDataSourceId);
    setIsConnected(true);
    setShowCredentials(false);
  };

  const handleDisconnect = () => {
    localStorage.removeItem('notion_api_key');
    localStorage.removeItem('notion_data_source_id');
    setApiKey('');
    setDataSourceId('');
    setIsConnected(false);
    setShowCredentials(true);
  };

  if (!isConnected || showCredentials) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/80 dark:bg-black/40 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent text-center">
            Connect Your Notion Database
          </h1>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Notion Integration Key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="secret_xxxxxxxxxxxxx or ntn_xxxxxxxxxxxxx"
                className="w-full px-4 py-3 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono text-sm"
                autoComplete="off"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get from{' '}
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline"
                >
                  notion.so/my-integrations
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Database Data Source ID
              </label>
              <input
                type="text"
                value={dataSourceId}
                onChange={(e) => setDataSourceId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-4 py-3 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">
                Found in your database URL or via Notion API
              </p>
            </div>

            <div className="pt-4 space-y-2">
              <button
                onClick={handleConnect}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all transform hover:scale-[1.02]"
              >
                Connect Database
              </button>

              {isConnected && (
                <button
                  onClick={() => setShowCredentials(false)}
                  className="w-full px-6 py-3 bg-gray-200 dark:bg-gray-700 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="font-semibold text-sm mb-2">How to get your credentials:</h3>
            <ol className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
              <li>1. Create an integration at notion.so/my-integrations</li>
              <li>2. Copy the "Integration Token" (API Key)</li>
              <li>3. Share your database with the integration</li>
              <li>4. Get the database/data source ID from the URL</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Settings button */}
      <button
        onClick={() => setShowCredentials(true)}
        className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 px-4 py-2 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-lg shadow-lg hover:shadow-xl transition-all border border-white/20 flex items-center space-x-2"
      >
        <span>⚙️</span>
        <span className="text-sm">Settings</span>
      </button>

      <CanvasView apiKey={apiKey} dataSourceId={dataSourceId} />
    </div>
  );
}
