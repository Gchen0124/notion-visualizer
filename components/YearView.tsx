'use client';

import { useState, useEffect } from 'react';
import DayBlock from './DayBlock';
import WeekBlock from './WeekBlock';

type TaskStatus = 'Not started' | 'In progress' | 'Complete' | 'Missing' | null;

interface DailyEntry {
  date: string;
  dayOfYear: number;
  plan: string;
  reality: string;
  pageId: string | null;
  taskStatus1: TaskStatus;
  taskStatus2: TaskStatus;
  taskStatus3: TaskStatus;
}

interface WeekEntry {
  weekTitle: string;
  startDate: string;
  endDate: string;
  weekPlan: string;
  weekReality: string;
  pageId: string | null;
}

interface WeekRow {
  week: WeekEntry;
  days: (DailyEntry | null)[]; // 7 slots for Mon-Sun
}

export default function YearView() {
  const [year, setYear] = useState(2025);
  const [dailyData, setDailyData] = useState<DailyEntry[]>([]);
  const [weekData, setWeekData] = useState<WeekEntry[]>([]);
  const [weekRows, setWeekRows] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both daily ritual and week planning data in parallel
      const [dailyResponse, weekResponse] = await Promise.all([
        fetch(`/api/daily-ritual?year=${year}`),
        fetch(`/api/week-planning?year=${year}`)
      ]);

      const dailyResult = await dailyResponse.json();
      const weekResult = await weekResponse.json();

      if (!dailyResult.success) {
        throw new Error(dailyResult.error || 'Failed to fetch daily data');
      }
      if (!weekResult.success) {
        throw new Error(weekResult.error || 'Failed to fetch week data');
      }

      setDailyData(dailyResult.data);
      setWeekData(weekResult.data);

      // Group days into week rows
      const rows = groupDaysIntoWeeks(dailyResult.data, weekResult.data, year);
      setWeekRows(rows);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // Group daily entries into week rows based on week boundaries
  const groupDaysIntoWeeks = (
    days: DailyEntry[],
    weeks: WeekEntry[],
    currentYear: number
  ): WeekRow[] => {
    const rows: WeekRow[] = [];
    const dayMap = new Map<string, DailyEntry>();

    // Create a map for quick day lookup
    days.forEach(day => dayMap.set(day.date, day));

    // Sort weeks by start date
    const sortedWeeks = [...weeks].sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    );

    // For each week, create a row with 7 days
    sortedWeeks.forEach(week => {
      const weekDays: (DailyEntry | null)[] = [];
      const startDate = new Date(week.startDate);

      // Generate 7 days starting from week start date
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + i);
        const dateStr = formatDate(dayDate);

        const dayEntry = dayMap.get(dateStr);
        if (dayEntry) {
          weekDays.push(dayEntry);
        } else {
          // Create placeholder for days outside the year or missing
          const dayYear = dayDate.getFullYear();
          if (dayYear === currentYear) {
            // Day is in current year but no data yet
            weekDays.push({
              date: dateStr,
              dayOfYear: getDayOfYear(dayDate),
              plan: '',
              reality: '',
              pageId: null,
              taskStatus1: null,
              taskStatus2: null,
              taskStatus3: null,
            });
          } else {
            // Day is outside current year (cross-year week)
            weekDays.push({
              date: dateStr,
              dayOfYear: getDayOfYear(dayDate),
              plan: '',
              reality: '',
              pageId: null,
              taskStatus1: null,
              taskStatus2: null,
              taskStatus3: null,
            });
          }
        }
      }

      rows.push({
        week,
        days: weekDays,
      });
    });

    return rows;
  };

  const handleDailyUpdate = async (
    date: string,
    type: 'plan' | 'reality',
    content: string
  ) => {
    try {
      const response = await fetch('/api/daily-ritual/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type, content }),
      });

      const result = await response.json();

      if (result.success) {
        // Update local state
        setDailyData(prevData =>
          prevData.map(entry =>
            entry.date === date
              ? { ...entry, [type]: content, pageId: result.pageId || entry.pageId }
              : entry
          )
        );
        // Refresh week rows
        const updatedDaily = dailyData.map(entry =>
          entry.date === date
            ? { ...entry, [type]: content, pageId: result.pageId || entry.pageId }
            : entry
        );
        setWeekRows(groupDaysIntoWeeks(updatedDaily, weekData, year));
      } else {
        alert('Failed to save: ' + (result.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Network error: ' + err.message);
    }
  };

  const handleWeekUpdate = async (
    pageId: string,
    type: 'plan' | 'reality',
    content: string
  ) => {
    try {
      const response = await fetch('/api/week-planning/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, type, content }),
      });

      const result = await response.json();

      if (result.success) {
        // Update local state
        const propertyName = type === 'plan' ? 'weekPlan' : 'weekReality';
        setWeekData(prevData =>
          prevData.map(entry =>
            entry.pageId === pageId
              ? { ...entry, [propertyName]: content }
              : entry
          )
        );
        // Refresh week rows
        const updatedWeeks = weekData.map(entry =>
          entry.pageId === pageId
            ? { ...entry, [propertyName]: content }
            : entry
        );
        setWeekRows(groupDaysIntoWeeks(dailyData, updatedWeeks, year));
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
          <p className="mt-4 text-gray-600">Loading {year} data...</p>
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

  // Calculate stats
  const dailyStats = {
    total: dailyData.length,
    withPlan: dailyData.filter(d => d.plan).length,
    withReality: dailyData.filter(d => d.reality).length,
    complete: dailyData.filter(d => d.plan && d.reality).length,
  };

  const weekStats = {
    total: weekData.length,
    withPlan: weekData.filter(w => w.weekPlan).length,
    withReality: weekData.filter(w => w.weekReality).length,
    complete: weekData.filter(w => w.weekPlan && w.weekReality).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-emerald-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Daily Ritual {year}</h1>
              <p className="text-sm text-gray-600 mt-1">
                Week & Daily Plan vs Reality
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
          <div className="mt-4 grid grid-cols-2 md:grid-cols-8 gap-2">
            {/* Week Stats */}
            <div className="text-center p-2 bg-purple-50 rounded">
              <div className="text-lg font-bold text-purple-700">{weekStats.total}</div>
              <div className="text-xs text-gray-600">Weeks</div>
            </div>
            <div className="text-center p-2 bg-purple-100 rounded">
              <div className="text-lg font-bold text-purple-600">{weekStats.withPlan}</div>
              <div className="text-xs text-gray-600">W/Plan</div>
            </div>
            <div className="text-center p-2 bg-orange-50 rounded">
              <div className="text-lg font-bold text-orange-600">{weekStats.withReality}</div>
              <div className="text-xs text-gray-600">W/Reality</div>
            </div>
            <div className="text-center p-2 bg-green-100 rounded">
              <div className="text-lg font-bold text-green-600">{weekStats.complete}</div>
              <div className="text-xs text-gray-600">W/Complete</div>
            </div>
            {/* Daily Stats */}
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-bold text-gray-700">{dailyStats.total}</div>
              <div className="text-xs text-gray-600">Days</div>
            </div>
            <div className="text-center p-2 bg-indigo-50 rounded">
              <div className="text-lg font-bold text-indigo-600">{dailyStats.withPlan}</div>
              <div className="text-xs text-gray-600">D/Plan</div>
            </div>
            <div className="text-center p-2 bg-emerald-50 rounded">
              <div className="text-lg font-bold text-emerald-600">{dailyStats.withReality}</div>
              <div className="text-xs text-gray-600">D/Reality</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded">
              <div className="text-lg font-bold text-green-600">{dailyStats.complete}</div>
              <div className="text-xs text-gray-600">D/Complete</div>
            </div>
          </div>
        </div>
      </header>

      {/* Week Rows */}
      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {/* Column Headers */}
        <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-2 mb-4 sticky top-[180px] bg-gradient-to-br from-indigo-50 to-emerald-50 py-2 z-5">
          <div className="text-center text-sm font-semibold text-purple-700">
            Week Plan/Reality
          </div>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center text-sm font-semibold text-gray-600">
              {day}
            </div>
          ))}
        </div>

        {/* Week Rows */}
        <div className="space-y-4">
          {weekRows.map((row, index) => {
            // Check if this week crosses year boundary
            const crossesYear = row.days.some(d => {
              if (!d) return false;
              const dayYear = new Date(d.date).getFullYear();
              return dayYear !== year;
            });

            return (
              <div
                key={row.week.pageId || index}
                className="grid grid-cols-[200px_repeat(7,1fr)] gap-2"
              >
                {/* Week Block */}
                <WeekBlock
                  weekTitle={row.week.weekTitle}
                  startDate={row.week.startDate}
                  endDate={row.week.endDate}
                  weekPlan={row.week.weekPlan}
                  weekReality={row.week.weekReality}
                  pageId={row.week.pageId}
                  onUpdate={(type, content) =>
                    row.week.pageId
                      ? handleWeekUpdate(row.week.pageId, type, content)
                      : Promise.resolve()
                  }
                />

                {/* Day Blocks */}
                {row.days.map((day, dayIndex) => {
                  if (!day) {
                    return (
                      <div
                        key={dayIndex}
                        className="border rounded-lg p-2 min-h-[120px] bg-gray-100 border-gray-200"
                      />
                    );
                  }

                  const dayYear = new Date(day.date).getFullYear();
                  const isOutsideYear = dayYear !== year;

                  return (
                    <div
                      key={day.date}
                      className={isOutsideYear ? 'opacity-50' : ''}
                    >
                      <DayBlock
                        date={day.date}
                        dayOfYear={day.dayOfYear}
                        plan={day.plan}
                        reality={day.reality}
                        taskStatus1={day.taskStatus1}
                        taskStatus2={day.taskStatus2}
                        taskStatus3={day.taskStatus3}
                        onUpdate={(type, content) =>
                          handleDailyUpdate(day.date, type, content)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// Helper functions
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}
