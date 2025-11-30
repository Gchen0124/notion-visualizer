'use client';

import { useState, useEffect } from 'react';
import DayBlock from './DayBlock';

interface DailyEntry {
  date: string;
  dayOfYear: number;
  plan: string;
  reality: string;
  pageId: string | null;
}

export default function YearView() {
  const [year, setYear] = useState(2025);
  const [data, setData] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/daily-ritual?year=${year}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (
    date: string,
    type: 'plan' | 'reality',
    content: string
  ) => {
    try {
      const response = await fetch('/api/daily-ritual/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date, type, content }),
      });

      const result = await response.json();

      if (result.success) {
        // Update local state
        setData((prevData) =>
          prevData.map((entry) =>
            entry.date === date
              ? {
                  ...entry,
                  [type]: content,
                  pageId: result.pageId || entry.pageId,
                }
              : entry
          )
        );
      } else {
        alert('Failed to save: ' + (result.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Network error: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading {year} daily ritual data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <p className="text-red-600 font-semibold">Error loading data</p>
          <p className="text-gray-600 mt-2">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = {
    total: data.length,
    withPlan: data.filter((d) => d.plan).length,
    withReality: data.filter((d) => d.reality).length,
    complete: data.filter((d) => d.plan && d.reality).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-emerald-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Daily Ritual {year}</h1>
              <p className="text-sm text-gray-600 mt-1">
                Plan vs Reality Tracking
              </p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600">Total Days</div>
            </div>
            <div className="text-center p-2 bg-indigo-50 rounded">
              <div className="text-xl font-bold text-indigo-600">{stats.withPlan}</div>
              <div className="text-xs text-gray-600">With Plan</div>
            </div>
            <div className="text-center p-2 bg-emerald-50 rounded">
              <div className="text-xl font-bold text-emerald-600">{stats.withReality}</div>
              <div className="text-xs text-gray-600">With Reality</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded">
              <div className="text-xl font-bold text-green-600">{stats.complete}</div>
              <div className="text-xs text-gray-600">Complete</div>
            </div>
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
          {data.map((entry) => (
            <DayBlock
              key={entry.date}
              date={entry.date}
              dayOfYear={entry.dayOfYear}
              plan={entry.plan}
              reality={entry.reality}
              onUpdate={(type, content) => handleUpdate(entry.date, type, content)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
