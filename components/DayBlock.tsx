'use client';

import { useState } from 'react';

type TaskStatus = 'Not started' | 'In progress' | 'Complete' | 'Missing' | null;

interface DayBlockProps {
  date: string;
  dayOfYear: number;
  plan: string;
  reality: string;
  taskStatus1: TaskStatus;
  taskStatus2: TaskStatus;
  taskStatus3: TaskStatus;
  onUpdate: (type: 'plan' | 'reality', content: string) => Promise<void>;
}

// Helper component for status indicator dot
function StatusDot({ status }: { status: TaskStatus }) {
  if (status === null) return null;

  let colorClass = '';
  let title = '';

  switch (status) {
    case 'Not started':
      colorClass = 'bg-red-500';
      title = 'Not started';
      break;
    case 'In progress':
      colorClass = 'bg-yellow-500';
      title = 'In progress';
      break;
    case 'Complete':
      colorClass = 'bg-green-500';
      title = 'Complete';
      break;
    case 'Missing':
      // White circle with red edge
      return (
        <span
          className="inline-block w-2 h-2 rounded-full bg-white border border-red-500"
          title="Missing"
        />
      );
  }

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colorClass}`}
      title={title}
    />
  );
}

export default function DayBlock({
  date,
  dayOfYear,
  plan,
  reality,
  taskStatus1,
  taskStatus2,
  taskStatus3,
  onUpdate,
}: DayBlockProps) {
  const [isEditing, setIsEditing] = useState<'plan' | 'reality' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const dateObj = new Date(date);
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
  const day = dateObj.getDate();

  const handleEdit = (type: 'plan' | 'reality') => {
    setIsEditing(type);
    setEditValue(type === 'plan' ? plan : reality);
  };

  const handleSave = async () => {
    if (isEditing && editValue !== (isEditing === 'plan' ? plan : reality)) {
      setIsSaving(true);
      try {
        await onUpdate(isEditing, editValue);
      } finally {
        setIsSaving(false);
      }
    }
    setIsEditing(null);
  };

  const handleCancel = () => {
    setIsEditing(null);
    setEditValue('');
  };

  const hasContent = plan || reality;
  const isComplete = plan && reality;

  return (
    <div
      className={`
        relative border rounded-lg p-2 min-h-[120px]
        transition-all duration-200
        ${hasContent ? 'bg-white' : 'bg-gray-50'}
        ${isComplete ? 'border-green-300' : hasContent ? 'border-blue-200' : 'border-gray-200'}
        hover:shadow-md
      `}
    >
      {/* Date Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-gray-700">{month}</span>
          <span className="text-sm font-bold text-gray-900">{day}</span>
          {/* Task Status Indicators */}
          <div className="flex items-center gap-0.5 ml-1">
            <StatusDot status={taskStatus1} />
            <StatusDot status={taskStatus2} />
            <StatusDot status={taskStatus3} />
          </div>
        </div>
        <span className="text-xs text-gray-400">#{dayOfYear}</span>
      </div>

      {/* Plan Section */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-indigo-600">Plan</span>
          {isEditing !== 'plan' && (
            <button
              onClick={() => handleEdit('plan')}
              className="text-xs text-gray-400 hover:text-indigo-600"
            >
              ✎
            </button>
          )}
        </div>
        {isEditing === 'plan' ? (
          <div>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full text-xs p-1 border rounded resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-600 line-clamp-2">
            {plan || <span className="text-gray-400 italic">No plan yet</span>}
          </p>
        )}
      </div>

      {/* Reality Section */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-emerald-600">Reality</span>
          {isEditing !== 'reality' && (
            <button
              onClick={() => handleEdit('reality')}
              className="text-xs text-gray-400 hover:text-emerald-600"
            >
              ✎
            </button>
          )}
        </div>
        {isEditing === 'reality' ? (
          <div>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full text-xs p-1 border rounded resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs px-2 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-600 line-clamp-2">
            {reality || <span className="text-gray-400 italic">No reality yet</span>}
          </p>
        )}
      </div>

      {/* Completion Indicator */}
      {isComplete && (
        <div className="absolute top-1 right-1">
          <span className="text-green-500 text-xs">✓</span>
        </div>
      )}
    </div>
  );
}
