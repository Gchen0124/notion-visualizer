'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

interface NotionNodeData {
  label: string;
  properties: Record<string, any>;
  color: string;
  visibleProperties: string[];
  onUpdateTitle: (newTitle: string) => void;
  onUpdateProperty: (propName: string, value: any) => void;
  onUpdateColor: (color: string) => void;
  onToggleSubItems?: () => void;
  onOpenPropertyEditor?: () => void;
  hasChildren?: boolean;
  childrenVisible?: boolean;
}

const COLORS = [
  { name: 'Purple', value: '#9333ea', light: '#a855f7' },
  { name: 'Pink', value: '#ec4899', light: '#f472b6' },
  { name: 'Blue', value: '#3b82f6', light: '#60a5fa' },
  { name: 'Green', value: '#10b981', light: '#34d399' },
  { name: 'Orange', value: '#f97316', light: '#fb923c' },
  { name: 'Red', value: '#ef4444', light: '#f87171' },
];

function NotionNode({ data, selected }: NodeProps<NotionNodeData>) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(data.label);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (title !== data.label) {
      data.onUpdateTitle(title);
    }
  };

  const currentColor = COLORS.find((c) => c.value === data.color) || COLORS[0];

  return (
    <div
      className={`min-w-[200px] max-w-[300px] rounded-xl backdrop-blur-md transition-all duration-200 ${
        selected ? 'ring-2 ring-offset-2 ring-offset-transparent' : ''
      }`}
      style={{
        backgroundColor: `${currentColor.value}20`,
        borderColor: currentColor.value,
        borderWidth: '2px',
        boxShadow: selected
          ? `0 8px 32px ${currentColor.value}40`
          : `0 4px 16px ${currentColor.value}20`,
        ringColor: currentColor.value,
      }}
    >
      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />

      {/* Header */}
      <div
        className="px-4 py-3 rounded-t-xl cursor-move relative"
        style={{
          background: `linear-gradient(135deg, ${currentColor.value}40, ${currentColor.light}30)`,
        }}
      >
        {isEditingTitle ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleBlur();
              if (e.key === 'Escape') {
                setTitle(data.label);
                setIsEditingTitle(false);
              }
            }}
            className="w-full bg-white/50 dark:bg-black/30 rounded px-2 py-1 text-sm font-semibold outline-none focus:ring-2"
            style={{ ringColor: currentColor.value }}
            autoFocus
          />
        ) : (
          <div
            className="flex items-center justify-between"
            onDoubleClick={() => setIsEditingTitle(true)}
          >
            <h3 className="font-semibold text-sm truncate flex-1">{data.label}</h3>
            <div className="flex items-center space-x-1">
              {data.onOpenPropertyEditor && (
                <button
                  onClick={data.onOpenPropertyEditor}
                  className="p-1 hover:bg-white/30 rounded transition-colors"
                  title="Edit properties"
                >
                  ✏️
                </button>
              )}
              {data.hasChildren && (
                <button
                  onClick={data.onToggleSubItems}
                  className="p-1 hover:bg-white/30 rounded transition-colors"
                  title={data.childrenVisible ? 'Hide sub-items' : 'Show sub-items'}
                >
                  {data.childrenVisible ? '👁️' : '👁️‍🗨️'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Color picker button */}
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="absolute top-2 right-2 w-4 h-4 rounded-full border-2 border-white shadow-md"
          style={{ backgroundColor: currentColor.value }}
        />

        {/* Color picker dropdown */}
        {showColorPicker && (
          <div className="absolute top-10 right-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-2 grid grid-cols-3 gap-2 z-50">
            {COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => {
                  data.onUpdateColor(color.value);
                  setShowColorPicker(false);
                }}
                className="w-8 h-8 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform"
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        )}
      </div>

      {/* Minimal footer - only show sub-item count if has children */}
      {data.hasChildren && (
        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          {data.childrenVisible ? 'Sub-items visible' : 'Sub-items hidden'}
        </div>
      )}
    </div>
  );
}

export default memo(NotionNode);
