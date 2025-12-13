'use client';

import { useState, useEffect } from 'react';

interface PropertyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  properties: Record<string, any>;
  schema: any[];
  onUpdateProperty: (propName: string, value: any) => void;
  allItems?: any[]; // For showing relation options
  pageUrl?: string; // URL to open in Notion
}

export default function PropertyEditorModal({
  isOpen,
  onClose,
  itemId,
  properties,
  schema,
  onUpdateProperty,
  allItems = [],
  pageUrl,
}: PropertyEditorModalProps) {
  const [editedProperties, setEditedProperties] = useState<Record<string, any>>({});

  useEffect(() => {
    setEditedProperties({ ...properties });
  }, [properties, itemId]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Save all changed properties
    Object.entries(editedProperties).forEach(([propName, value]) => {
      if (value !== properties[propName]) {
        onUpdateProperty(propName, value);
      }
    });
    onClose();
  };

  const handleChange = (propName: string, value: any) => {
    setEditedProperties((prev) => ({ ...prev, [propName]: value }));
  };

  const renderPropertyInput = (schemaProp: any) => {
    const { name, type } = schemaProp;
    const value = editedProperties[name];

    switch (type) {
      case 'title':
      case 'rich_text':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(name, e.target.value)}
            className="w-full px-3 py-2 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(name, parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
          />
        );

      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => handleChange(name, e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
        );

      case 'select':
      case 'status':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleChange(name, e.target.value)}
              className="w-full px-3 py-2 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
              placeholder={`Enter ${type} value`}
            />
            <p className="text-xs text-gray-500">Tip: Type the exact option name from Notion</p>
          </div>
        );

      case 'multi_select':
        const currentSelections = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 p-2 bg-white/30 dark:bg-black/20 rounded-lg min-h-[40px]">
              {currentSelections.map((tag: string, idx: number) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded text-xs"
                >
                  {tag}
                  <button
                    onClick={() => {
                      handleChange(name, currentSelections.filter((_: string, i: number) => i !== idx));
                    }}
                    className="ml-1 text-red-600 hover:text-red-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Type and press Enter to add..."
              className="w-full px-3 py-2 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                  e.preventDefault();
                  const newTag = (e.target as HTMLInputElement).value.trim();
                  if (!currentSelections.includes(newTag)) {
                    handleChange(name, [...currentSelections, newTag]);
                  }
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => handleChange(name, e.target.value)}
            className="w-full px-3 py-2 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
          />
        );

      case 'url':
        return (
          <input
            type="url"
            value={value || ''}
            onChange={(e) => handleChange(name, e.target.value)}
            className="w-full px-3 py-2 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={value || ''}
            onChange={(e) => handleChange(name, e.target.value)}
            className="w-full px-3 py-2 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
          />
        );

      case 'phone_number':
        return (
          <input
            type="tel"
            value={value || ''}
            onChange={(e) => handleChange(name, e.target.value)}
            className="w-full px-3 py-2 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
          />
        );

      case 'relation':
        // Find title property for displaying item names
        const titleProp = schema.find((s) => s.type === 'title')?.name || 'Task Plan';
        const selectedIds = Array.isArray(value) ? value : [];

        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 p-2 bg-white/30 dark:bg-black/20 rounded-lg min-h-[40px]">
              {selectedIds.map((id: string) => {
                const item = allItems.find((i) => i.id === id);
                const itemTitle = item?.properties[titleProp] || 'Unknown';
                return (
                  <span
                    key={id}
                    className="inline-flex items-center px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded text-xs"
                  >
                    {itemTitle}
                    <button
                      onClick={() => {
                        handleChange(name, selectedIds.filter((i: string) => i !== id));
                      }}
                      className="ml-1 text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
            <select
              onChange={(e) => {
                if (e.target.value && !selectedIds.includes(e.target.value)) {
                  handleChange(name, [...selectedIds, e.target.value]);
                  e.target.value = '';
                }
              }}
              className="w-full px-3 py-2 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">+ Add relation...</option>
              {allItems
                .filter((item) => item.id !== itemId && !selectedIds.includes(item.id))
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.properties[titleProp] || 'Untitled'}
                  </option>
                ))}
            </select>
          </div>
        );

      case 'people':
        return (
          <div className="text-sm text-gray-500">
            People property (read-only in this version)
          </div>
        );

      case 'files':
        const files = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {files.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {files.map((file: any, idx: number) => (
                  <div key={idx} className="relative group">
                    {file.url && (file.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || file.url?.match(/\.(jpg|jpeg|png|gif|webp)/i)) ? (
                      <img
                        src={file.url}
                        alt={file.name || 'File'}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200">
                        <span className="text-2xl">📄</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1 truncate">{file.name || 'File'}</p>
                    {file.url && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center text-white text-xs"
                      >
                        Open
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No files attached</p>
            )}
            <p className="text-xs text-gray-400">Files can only be edited in Notion</p>
          </div>
        );

      case 'formula':
      case 'rollup':
      case 'created_time':
      case 'last_edited_time':
      case 'created_by':
      case 'last_edited_by':
        return (
          <div className="text-sm text-gray-500">
            {type} (computed/read-only)
          </div>
        );

      default:
        return (
          <div className="text-sm text-gray-500">
            {type} (read-only)
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[80vh] bg-white/95 dark:bg-gray-100/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-200 dark:to-pink-200 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Edit Properties
            </h2>
            {pageUrl && (
              <a
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-white/80 hover:bg-white rounded-lg text-sm font-medium text-gray-700 hover:text-gray-900 transition-all flex items-center gap-1.5 shadow-sm border border-gray-200"
              >
                <span>📝</span>
                <span>Open in Notion</span>
              </a>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Edit properties directly or open in Notion for full page content editing
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-white dark:bg-gray-50">
          {schema.map((schemaProp) => (
            <div key={schemaProp.name} className="space-y-2">
              <label className="block text-sm font-medium">
                {schemaProp.name}
                <span className="text-xs text-gray-500 ml-2">({schemaProp.type})</span>
              </label>
              {renderPropertyInput(schemaProp)}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-100 dark:to-pink-100 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-400 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all transform hover:scale-[1.02]"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
