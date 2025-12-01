'use client';

import { useState, useEffect } from 'react';

interface PropertyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  properties: Record<string, any>;
  schema: any[];
  onUpdateProperty: (propName: string, value: any) => void;
}

export default function PropertyEditorModal({
  isOpen,
  onClose,
  itemId,
  properties,
  schema,
  onUpdateProperty,
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
          {schema
            .filter((s) => !['relation', 'formula', 'rollup', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by'].includes(s.type))
            .map((schemaProp) => (
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
