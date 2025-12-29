'use client';

import { useState, useEffect } from 'react';
import { DatabaseInfo } from '@/lib/database-setup';

interface DatabasePickerProps {
  apiKey: string;
  onSelect: (database: DatabaseInfo) => void;
  onCancel: () => void;
  selectedId?: string;
}

export default function DatabasePicker({
  apiKey,
  onSelect,
  onCancel,
  selectedId,
}: DatabasePickerProps) {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDatabases() {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(
          `/api/databases/list?apiKey=${encodeURIComponent(apiKey)}`
        );
        const result = await response.json();

        if (result.success) {
          setDatabases(result.databases);
          if (result.databases.length === 0) {
            setError(
              'No databases found. Make sure you have shared at least one database with your integration.'
            );
          }
        } else {
          setError(result.error || 'Failed to fetch databases');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch databases');
      } finally {
        setLoading(false);
      }
    }

    fetchDatabases();
  }, [apiKey]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <svg
          className="animate-spin h-8 w-8 mx-auto mb-4 text-purple-400"
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
        <p className="text-gray-400">Loading your databases...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
        <button
          onClick={onCancel}
          className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Select a Database</h3>
      <p className="text-sm text-gray-400">
        Choose the database you want to visualize on the canvas
      </p>

      <div className="max-h-64 overflow-y-auto space-y-2">
        {databases.map((db) => (
          <button
            key={db.id}
            onClick={() => onSelect(db)}
            className={`w-full p-4 text-left rounded-lg border transition-all ${
              selectedId === db.id
                ? 'bg-purple-900/50 border-purple-500'
                : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700 hover:border-purple-400'
            }`}
          >
            <div className="font-medium text-white">{db.title}</div>
            <div className="text-xs text-gray-400 mt-1 font-mono">
              {db.id}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Object.keys(db.properties).length} properties
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={onCancel}
        className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-all"
      >
        Cancel
      </button>
    </div>
  );
}
