'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';

interface NotionNodeData {
  label: string;
  properties: Record<string, any>;
  color: string;
  gradientColors?: { start: string; end: string };
  visibleProperties: string[];
  onUpdateTitle: (newTitle: string) => void;
  onUpdateProperty: (propName: string, value: any) => void;
  onUpdateColor: (color: string) => void;
  onUpdateGradient?: (start: string, end: string) => void;
  onToggleSubItems?: () => void;
  onOpenPropertyEditor?: () => void;
  hasChildren?: boolean;
  childrenVisible?: boolean;
  subItems?: Array<{ id: string; title: string; color?: string }>;
}

function NotionNode({ data, selected }: NodeProps<NotionNodeData>) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(data.label);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (title !== data.label) {
      data.onUpdateTitle(title);
    }
  };

  // Use gradient colors if available, otherwise fallback to solid color
  const gradientStyle = data.gradientColors
    ? `linear-gradient(135deg, ${data.gradientColors.start}, ${data.gradientColors.end})`
    : `linear-gradient(135deg, ${data.color}, ${data.color})`;

  const borderColor = data.gradientColors ? data.gradientColors.start : data.color;

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Node Resizer - allows resizing the block */}
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
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

          {/* Color/Gradient picker button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowColorPicker(!showColorPicker);
            }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform"
            style={{ background: gradientStyle }}
          />

          {/* Advanced Color picker dropdown */}
          {showColorPicker && (
            <div className="absolute top-10 right-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-2xl p-4 z-50 min-w-[280px]">
              <h4 className="text-xs font-semibold mb-3">Background Style</h4>

              {/* Gradient presets */}
              <div className="space-y-2 mb-3">
                <p className="text-xs text-gray-600 dark:text-gray-400">Gradients</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: 'Purple Dream', start: '#9333ea', end: '#c084fc' },
                    { name: 'Ocean Blue', start: '#0ea5e9', end: '#6366f1' },
                    { name: 'Sunset', start: '#f97316', end: '#ec4899' },
                    { name: 'Forest', start: '#059669', end: '#10b981' },
                    { name: 'Rose Gold', start: '#be123c', end: '#fda4af' },
                    { name: 'Midnight', start: '#1e293b', end: '#475569' },
                  ].map((gradient) => (
                    <button
                      key={gradient.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        data.onUpdateGradient && data.onUpdateGradient(gradient.start, gradient.end);
                        setShowColorPicker(false);
                      }}
                      className="h-10 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:scale-105 transition-transform"
                      style={{ background: `linear-gradient(135deg, ${gradient.start}, ${gradient.end})` }}
                      title={gradient.name}
                    />
                  ))}
                </div>
              </div>

              {/* White background option */}
              <div className="space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-400">Solid</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onUpdateGradient && data.onUpdateGradient('#ffffff', '#ffffff');
                    setShowColorPicker(false);
                  }}
                  className="w-full h-10 rounded-lg border-2 border-gray-300 hover:scale-105 transition-transform bg-white"
                  title="White"
                >
                  <span className="text-xs text-gray-800">White</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content area - show sub-items on hover */}
        <div className="flex-1 px-4 py-3 overflow-hidden">
          {isHovering && data.subItems && data.subItems.length > 0 && (
            <div className="space-y-2 animate-fadeIn">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Sub-items:</p>
              {data.subItems.slice(0, 5).map((subItem, index) => (
                <div
                  key={subItem.id}
                  className="px-3 py-2 rounded-lg bg-white/50 dark:bg-black/30 backdrop-blur-sm border border-white/30 text-xs"
                  style={{
                    borderLeft: `3px solid ${subItem.color || '#6b7280'}`,
                    animation: `slideIn 0.2s ease-out ${index * 0.05}s both`,
                  }}
                >
                  {subItem.title}
                </div>
              ))}
              {data.subItems.length > 5 && (
                <div className="text-xs text-gray-500 italic">
                  +{data.subItems.length - 5} more...
                </div>
              )}
            </div>
          )}
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
