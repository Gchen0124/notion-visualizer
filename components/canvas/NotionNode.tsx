'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';

interface NotionNodeData {
  label: string;
  properties: Record<string, any>;
  color: string;
  gradientColors?: { start: string; end: string };
  visibleProperties: string[];
  titleProp: string;
  allItems: any[];
  onUpdateTitle: (newTitle: string) => void;
  onUpdateProperty: (propName: string, value: any) => void;
  onUpdateColor: (color: string) => void;
  onUpdateGradient?: (start: string, end: string) => void;
  onToggleSubItems?: () => void;
  onOpenPropertyEditor?: () => void;
  onAddSubItem?: () => void;
  onDeleteSubItem?: (subItemId: string) => void;
  onReorderSubItems?: (subItemId: string, direction: 'up' | 'down') => void;
  hasChildren?: boolean;
  childrenVisible?: boolean;
}

function NotionNode({ data, selected }: NodeProps<NotionNodeData>) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(data.label);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (title !== data.label) {
      console.log('[NotionNode] Title changed from', data.label, 'to', title);
      data.onUpdateTitle(title);
    }
  };

  // Use gradient colors if available, otherwise fallback to solid color
  const gradientStyle = data.gradientColors
    ? `linear-gradient(135deg, ${data.gradientColors.start}, ${data.gradientColors.end})`
    : `linear-gradient(135deg, ${data.color}, ${data.color})`;

  const borderColor = data.gradientColors ? data.gradientColors.start : data.color;

  // Read Sub-item property directly from properties (it's an array of IDs)
  const subItemIds = Array.isArray(data.properties['Sub-item']) ? data.properties['Sub-item'] : [];

  // Map IDs to actual items with titles
  const subItems = subItemIds.map((id: string) => {
    const item = data.allItems.find((i) => i.id === id);
    const itemTitle = item?.properties[data.titleProp] || 'Untitled';
    const itemColor = item?.properties.canvas_gradient_start || item?.properties.canvas_color || '#6b7280';
    return {
      id,
      title: itemTitle,
      color: itemColor,
    };
  });

  return (
    <div className="relative w-full h-full">
      {/* Node Resizer - allows resizing the block */}
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        handleStyle={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
        }}
      />

      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3" />

      {/* Main card */}
      <div
        className={`w-full h-full rounded-xl backdrop-blur-md transition-all duration-200 flex flex-col ${
          selected ? 'ring-2 ring-offset-2 ring-offset-transparent shadow-2xl' : 'shadow-lg'
        }`}
        style={{
          background: gradientStyle,
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: '#ffffff40',
          boxShadow: selected
            ? `0 8px 32px ${borderColor}60`
            : `0 4px 16px ${borderColor}40`,
        }}
      >
        {/* Header with title */}
        <div
          className="px-4 py-3 rounded-t-xl cursor-move relative bg-white/10 dark:bg-black/10"
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
              className="w-full bg-white/70 dark:bg-black/40 rounded px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-white/50"
              autoFocus
            />
          ) : (
            <div
              className="flex items-center justify-between"
              onClick={() => setIsEditingTitle(true)}
            >
              <h3 className="font-semibold text-sm flex-1 cursor-text">{data.label}</h3>
              <div className="flex items-center space-x-1">
                {/* Color picker button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(!showColorPicker);
                  }}
                  className="p-1 w-6 h-6 rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform"
                  style={{ background: gradientStyle }}
                  title="Change colors"
                />
                {data.onOpenPropertyEditor && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onOpenPropertyEditor();
                    }}
                    className="p-1.5 hover:bg-white/30 rounded-md transition-colors"
                    title="Edit properties"
                  >
                    ⚙️
                  </button>
                )}
                {data.hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onToggleSubItems && data.onToggleSubItems();
                    }}
                    className="p-1.5 hover:bg-white/30 rounded-md transition-colors"
                    title={data.childrenVisible ? 'Hide sub-items' : 'Show sub-items'}
                  >
                    {data.childrenVisible ? '👁️' : '👁️‍🗨️'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Color picker dropdown */}
          {showColorPicker && (
            <div className="absolute top-12 right-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-2xl p-4 z-50 min-w-[280px]">
              <h4 className="text-xs font-semibold mb-3">Background Colors</h4>

              {/* Custom color pickers */}
              <div className="space-y-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                    Gradient Start
                  </label>
                  <input
                    type="color"
                    value={data.gradientColors?.start || data.color}
                    onChange={(e) => {
                      e.stopPropagation();
                      const newStart = e.target.value;
                      const currentEnd = data.gradientColors?.end || data.color;
                      data.onUpdateGradient && data.onUpdateGradient(newStart, currentEnd);
                    }}
                    className="w-full h-10 rounded-lg cursor-pointer border-2 border-gray-300 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                    Gradient End
                  </label>
                  <input
                    type="color"
                    value={data.gradientColors?.end || data.color}
                    onChange={(e) => {
                      e.stopPropagation();
                      const newEnd = e.target.value;
                      const currentStart = data.gradientColors?.start || data.color;
                      data.onUpdateGradient && data.onUpdateGradient(currentStart, newEnd);
                    }}
                    className="w-full h-10 rounded-lg cursor-pointer border-2 border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>

              {/* Quick preset gradients */}
              <div className="space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-400">Quick Presets</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: 'Purple', start: '#9333ea', end: '#c084fc' },
                    { name: 'Blue', start: '#0ea5e9', end: '#6366f1' },
                    { name: 'Sunset', start: '#f97316', end: '#ec4899' },
                    { name: 'Forest', start: '#059669', end: '#10b981' },
                    { name: 'Rose', start: '#be123c', end: '#fda4af' },
                    { name: 'White', start: '#ffffff', end: '#ffffff' },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        data.onUpdateGradient && data.onUpdateGradient(preset.start, preset.end);
                      }}
                      className="h-8 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:scale-105 transition-transform text-xs"
                      style={{ background: `linear-gradient(135deg, ${preset.start}, ${preset.end})` }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content area - show sub-items as nested blocks */}
        <div className="flex-1 px-4 py-3 overflow-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                Sub-items {subItems && subItems.length > 0 && `(${subItems.length})`}
              </p>
              {data.onAddSubItem && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onAddSubItem && data.onAddSubItem();
                  }}
                  className="px-2 py-1 text-xs bg-white/60 dark:bg-black/40 hover:bg-white/80 dark:hover:bg-black/50 rounded-md transition-colors border border-white/40"
                  title="Add sub-item"
                >
                  ➕ Add
                </button>
              )}
            </div>

            {subItems && subItems.length > 0 ? (
              subItems.map((subItem, index) => (
                <div
                  key={subItem.id}
                  className="group px-3 py-2 rounded-lg bg-white/60 dark:bg-black/40 backdrop-blur-sm border border-white/40 text-xs transition-all hover:bg-white/80 dark:hover:bg-black/50 hover:shadow-md"
                  style={{
                    borderLeft: `3px solid ${subItem.color || '#6b7280'}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-1">{subItem.title}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Move up button */}
                      {index > 0 && data.onReorderSubItems && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            data.onReorderSubItems && data.onReorderSubItems(subItem.id, 'up');
                          }}
                          className="p-1 hover:bg-white/50 dark:hover:bg-black/30 rounded transition-colors"
                          title="Move up"
                        >
                          ⬆️
                        </button>
                      )}
                      {/* Move down button */}
                      {index < subItems.length - 1 && data.onReorderSubItems && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            data.onReorderSubItems && data.onReorderSubItems(subItem.id, 'down');
                          }}
                          className="p-1 hover:bg-white/50 dark:hover:bg-black/30 rounded transition-colors"
                          title="Move down"
                        >
                          ⬇️
                        </button>
                      )}
                      {/* Delete button */}
                      {data.onDeleteSubItem && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete sub-item "${subItem.title}"?`)) {
                              data.onDeleteSubItem && data.onDeleteSubItem(subItem.id);
                            }
                          }}
                          className="p-1 hover:bg-red-500/50 rounded transition-colors"
                          title="Delete sub-item"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center py-4">
                No sub-items yet. Click "Add" to create one.
              </p>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default memo(NotionNode);
