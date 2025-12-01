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
}

export default function PropertyEditorModal({
  isOpen,
  onClose,
  itemId,
  properties,
  schema,
  onUpdateProperty,
  allItems = [],
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
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(name, e.target.value)}
            className="w-full px-3 py-2 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Enter select value"
          />
        );

      case 'multi_select':
        return (
          <input
            type="text"
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={(e) => handleChange(name, e.target.value.split(',').map((v) => v.trim()))}
            className="w-full px-3 py-2 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Comma-separated values"
          />
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
        return (
          <div className="text-sm text-gray-500">
            Files property (read-only in this version)
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
      <div className="w-full max-w-2xl max-h-[80vh] bg-white/90 dark:bg-black/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-white/20">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Edit Properties
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-t border-white/20 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
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
