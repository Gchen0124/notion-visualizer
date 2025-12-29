'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  onToggleImage?: () => void;
  hasChildren?: boolean;
  childrenVisible?: boolean;
  showImage?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NotionNode({ data, selected }: NodeProps<any> & { data: NotionNodeData }) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(data.label);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);

  // Update picker position when button is clicked
  const handleColorPickerToggle = () => {
    if (!showColorPicker && colorButtonRef.current) {
      const rect = colorButtonRef.current.getBoundingClientRect();
      setPickerPosition({
        top: rect.bottom + 8,
        left: Math.max(8, rect.right - 280), // 280px is min-width of picker, ensure it stays on screen
      });
    }
    setShowColorPicker(!showColorPicker);
  };

  // Close color picker when clicking outside
  useEffect(() => {
    if (!showColorPicker) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't close if clicking the color button itself
      if (colorButtonRef.current?.contains(target)) {
        return;
      }

      // Close if clicking outside the color picker
      if (colorPickerRef.current && !colorPickerRef.current.contains(target)) {
        setShowColorPicker(false);
      }
    };

    // Use setTimeout to add listener after current click event finishes
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [showColorPicker]);

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
    const item = data.allItems.find((i: any) => i.id === id);
    const itemTitle = item?.properties[data.titleProp] || 'Untitled';
    const itemColor = item?.properties.canvas_gradient_start || item?.properties.canvas_color || '#6b7280';
    return {
      id,
      title: itemTitle,
      color: itemColor,
    };
  });

  // Get image URL from Canvas_Visual property (files type)
  const canvasVisual = data.properties['Canvas_Visual'];
  const imageUrl = Array.isArray(canvasVisual) && canvasVisual.length > 0
    ? canvasVisual[0]?.url
    : null;
  const hasImage = !!imageUrl;

  return (
    <div className="relative w-full h-full">
      {/* Node Resizer - allows resizing the block with modern white handles */}
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        lineStyle={{
          border: 'none',
        }}
        handleStyle={{
          width: '12px',
          height: '12px',
          borderRadius: '3px',
          backgroundColor: 'white',
          border: '2px solid rgba(0, 0, 0, 0.2)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}
      />

      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3" />

      {/* Main card */}
      <div
        className={`w-full h-full rounded-xl backdrop-blur-md transition-all duration-200 ${
          data.childrenVisible ? 'flex flex-col' : 'flex flex-col justify-center'
        } ${selected ? 'ring-2 ring-offset-2 ring-offset-transparent shadow-2xl' : 'shadow-lg'} overflow-hidden`}
        style={{
          background: data.showImage && imageUrl
            ? `url(${imageUrl}) center/cover no-repeat`
            : gradientStyle,
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: '#ffffff40',
          boxShadow: selected
            ? `0 8px 32px ${borderColor}60`
            : `0 4px 16px ${borderColor}40`,
        }}
      >
        {/* Photo Mode Layout - Clean centered title */}
        {data.showImage && imageUrl && !data.childrenVisible && (
          <div className="absolute inset-0 flex flex-col">
            {/* Centered title */}
            <div className="flex-1 flex items-center justify-center px-4 cursor-move">
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
                  className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2 text-lg font-semibold outline-none focus:ring-2 focus:ring-white/50 shadow-lg text-center max-w-[90%]"
                  autoFocus
                />
              ) : (
                <h3
                  onClick={() => setIsEditingTitle(true)}
                  className="text-xl font-bold cursor-text px-4 py-2 rounded-xl backdrop-blur-md bg-black/40 text-white shadow-lg border border-white/20 text-center max-w-[90%] truncate"
                >
                  {data.label}
                </h3>
              )}
            </div>

            {/* Bottom toolbar - sleek glassmorphism */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-full backdrop-blur-xl bg-black/30 border border-white/20 shadow-lg">
                {/* Color picker */}
                <button
                  ref={colorButtonRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleColorPickerToggle();
                  }}
                  className="w-6 h-6 rounded-full border-2 border-white/50 shadow-sm hover:scale-110 transition-transform"
                  style={{ background: gradientStyle }}
                  title="Change colors"
                />
                {/* Image toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onToggleImage && data.onToggleImage();
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-sm"
                  title="Hide image"
                >
                  🖼️
                </button>
                {/* Settings */}
                {data.onOpenPropertyEditor && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onOpenPropertyEditor();
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-sm"
                    title="Edit properties"
                  >
                    ⚙️
                  </button>
                )}
                {/* Sub-items toggle */}
                {data.hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onToggleSubItems && data.onToggleSubItems();
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-sm"
                    title="Show sub-items"
                  >
                    👁️‍🗨️
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Normal Mode Header - only show when NOT in photo mode without children */}
        {!(data.showImage && imageUrl && !data.childrenVisible) && (
        <div
          className={`px-4 py-3 cursor-move relative ${
            data.childrenVisible
              ? 'rounded-t-xl bg-white/10 dark:bg-black/10'
              : 'bg-transparent'
          }`}
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
              className={`flex items-center ${
                data.childrenVisible ? 'justify-between' : 'justify-center'
              }`}
              onClick={() => setIsEditingTitle(true)}
            >
              <h3
                className={`font-semibold cursor-text ${
                  data.childrenVisible ? 'text-sm' : 'text-2xl'
                }`}
              >
                {data.label}
              </h3>
              {data.childrenVisible && (
                <div className="flex items-center space-x-1">
                  {/* Color picker button */}
                  <button
                    ref={colorButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleColorPickerToggle();
                    }}
                    className="p-1 w-6 h-6 rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform"
                    style={{ background: gradientStyle }}
                    title="Change colors"
                  />
                  {/* Image toggle button */}
                  {hasImage && data.onToggleImage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        data.onToggleImage();
                      }}
                      className={`p-1.5 rounded-md transition-colors ${data.showImage ? 'bg-purple-500/50' : 'hover:bg-white/30'}`}
                      title={data.showImage ? 'Hide image background' : 'Show image background'}
                    >
                      🖼️
                    </button>
                  )}
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
              )}
            </div>
          )}

          {/* Color picker dropdown - rendered via portal to avoid overflow clipping */}
          {showColorPicker && typeof document !== 'undefined' && createPortal(
            <div
              ref={colorPickerRef}
              className="fixed bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-2xl p-4 min-w-[280px]"
              style={{
                top: pickerPosition.top,
                left: pickerPosition.left,
                zIndex: 9999,
              }}
            >
              <h4 className="text-xs font-semibold mb-3 text-gray-800 dark:text-gray-200">Background Colors</h4>

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
            </div>,
            document.body
          )}
        </div>
        )}

        {/* Content area - only show when childrenVisible is true */}
        {data.childrenVisible && (
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
                    <span className="flex-1 text-white">{subItem.title}</span>
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
        )}

        {/* Footer with icons - only show when childrenVisible is false AND not in photo mode */}
        {!data.childrenVisible && !(data.showImage && imageUrl) && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center items-center px-4">
            <div className="flex items-center space-x-2">
              {/* Color picker button */}
              <button
                ref={colorButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  handleColorPickerToggle();
                }}
                className="p-1.5 w-7 h-7 rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform"
                style={{ background: gradientStyle }}
                title="Change colors"
              />
              {/* Image toggle button */}
              {hasImage && data.onToggleImage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onToggleImage();
                  }}
                  className={`p-1.5 rounded-md transition-colors ${data.showImage ? 'bg-purple-500/50' : 'hover:bg-white/30'}`}
                  title={data.showImage ? 'Hide image background' : 'Show image background'}
                >
                  🖼️
                </button>
              )}
              {/* Settings icon */}
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
              {/* Show sub-items icon */}
              {data.hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onToggleSubItems && data.onToggleSubItems();
                  }}
                  className="p-1.5 hover:bg-white/30 rounded-md transition-colors"
                  title="Show sub-items"
                >
                  👁️‍🗨️
                </button>
              )}
            </div>
          </div>
        )}
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
