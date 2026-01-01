'use client';

import { useState, useRef, useEffect } from 'react';

interface WeekBlockProps {
  weekTitle: string;
  startDate: string;
  endDate: string;
  weekPlan: string;
  weekReality: string;
  pageId: string | null;
  onUpdate: (type: 'plan' | 'reality', content: string) => Promise<void>;
}

export default function WeekBlock({
  weekTitle,
  startDate,
  endDate,
  weekPlan,
  weekReality,
  pageId,
  onUpdate,
}: WeekBlockProps) {
  const [isEditing, setIsEditing] = useState<'plan' | 'reality' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'plan' | 'reality' | null>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const realityRef = useRef<HTMLDivElement>(null);
  const [planOverflows, setPlanOverflows] = useState(false);
  const [realityOverflows, setRealityOverflows] = useState(false);

  // Check if content overflows
  useEffect(() => {
    if (planRef.current) {
      setPlanOverflows(planRef.current.scrollHeight > planRef.current.clientHeight);
    }
    if (realityRef.current) {
      setRealityOverflows(realityRef.current.scrollHeight > realityRef.current.clientHeight);
    }
  }, [weekPlan, weekReality]);

  // Parse dates for display
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const startMonth = startDateObj.toLocaleDateString('en-US', { month: 'short' });
  const startDay = startDateObj.getDate();
  const endMonth = endDateObj.toLocaleDateString('en-US', { month: 'short' });
  const endDay = endDateObj.getDate();

  // Format date range (e.g., "Dec 8-14" or "Dec 29 - Jan 4")
  const dateRange = startMonth === endMonth
    ? `${startMonth} ${startDay}-${endDay}`
    : `${startMonth} ${startDay} - ${endMonth} ${endDay}`;

  const handleEdit = (type: 'plan' | 'reality') => {
    if (!pageId) return; // Can't edit if no page exists
    setIsEditing(type);
    setEditValue(type === 'plan' ? weekPlan : weekReality);
  };

  const handleSave = async () => {
    if (isEditing && editValue !== (isEditing === 'plan' ? weekPlan : weekReality)) {
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

  const hasContent = weekPlan || weekReality;
  const isComplete = weekPlan && weekReality;

  return (
    <div
      className={`
        relative border rounded-lg p-3 min-h-[120px] w-full
        transition-all duration-200
        ${hasContent ? 'bg-purple-50' : 'bg-gray-50'}
        ${isComplete ? 'border-purple-400' : hasContent ? 'border-purple-200' : 'border-gray-200'}
        hover:shadow-md
      `}
    >
      {/* Week Header */}
      <div className="mb-3 pb-2 border-b border-purple-200">
        <div className="text-xs font-bold text-purple-700 truncate" title={weekTitle}>
          {weekTitle || 'Week'}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {dateRange}
        </div>
      </div>

      {/* Week Plan Section */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-purple-600">Week Plan</span>
          {isEditing !== 'plan' && pageId && (
            <button
              onClick={() => handleEdit('plan')}
              className="text-xs text-gray-400 hover:text-purple-600"
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
              rows={3}
              autoFocus
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
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
          <div
            ref={planRef}
            onClick={() => planOverflows && setExpandedSection(expandedSection === 'plan' ? null : 'plan')}
            className={`
              text-xs text-gray-600 whitespace-pre-wrap cursor-pointer
              ${expandedSection === 'plan' ? 'max-h-48 overflow-y-auto' : 'line-clamp-3'}
              ${planOverflows && expandedSection !== 'plan' ? 'hover:bg-purple-100 rounded transition-colors' : ''}
            `}
            title={planOverflows ? 'Click to expand' : undefined}
          >
            {weekPlan || <span className="text-gray-400 italic">No plan yet</span>}
            {planOverflows && expandedSection !== 'plan' && (
              <span className="text-purple-400 text-[10px] ml-1">...</span>
            )}
          </div>
        )}
      </div>

      {/* Week Reality Section */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-orange-600">Week Reality</span>
          {isEditing !== 'reality' && pageId && (
            <button
              onClick={() => handleEdit('reality')}
              className="text-xs text-gray-400 hover:text-orange-600"
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
              rows={3}
              autoFocus
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
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
          <div
            ref={realityRef}
            onClick={() => realityOverflows && setExpandedSection(expandedSection === 'reality' ? null : 'reality')}
            className={`
              text-xs text-gray-600 whitespace-pre-wrap cursor-pointer
              ${expandedSection === 'reality' ? 'max-h-48 overflow-y-auto' : 'line-clamp-3'}
              ${realityOverflows && expandedSection !== 'reality' ? 'hover:bg-orange-100 rounded transition-colors' : ''}
            `}
            title={realityOverflows ? 'Click to expand' : undefined}
          >
            {weekReality || <span className="text-gray-400 italic">No reality yet</span>}
            {realityOverflows && expandedSection !== 'reality' && (
              <span className="text-orange-400 text-[10px] ml-1">...</span>
            )}
          </div>
        )}
      </div>

      {/* Completion Indicator */}
      {isComplete && (
        <div className="absolute top-2 right-2">
          <span className="text-purple-500 text-xs">✓</span>
        </div>
      )}
    </div>
  );
}
