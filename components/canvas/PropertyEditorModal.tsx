'use client';

import { useState, useEffect } from 'react';

interface Block {
  id: string;
  type: string;
  content: string;
  hasChildren: boolean;
  editable: boolean;
}

interface PropertyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  properties: Record<string, any>;
  schema: any[];
  onUpdateProperty: (propName: string, value: any) => void;
  allItems?: any[]; // For showing relation options
  pageUrl?: string; // URL to open in Notion
  apiKey?: string; // API key for fetching page content
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
  apiKey,
}: PropertyEditorModalProps) {
  const [editedProperties, setEditedProperties] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<'properties' | 'content'>('properties');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockContent, setEditingBlockContent] = useState('');
  const [newBlockContent, setNewBlockContent] = useState('');
  const [newBlockType, setNewBlockType] = useState('paragraph');
  const [savingBlock, setSavingBlock] = useState(false);

  useEffect(() => {
    setEditedProperties({ ...properties });
  }, [properties, itemId]);

  // Fetch blocks when content tab is selected
  useEffect(() => {
    if (activeTab === 'content' && apiKey && itemId && blocks.length === 0) {
      fetchBlocks();
    }
  }, [activeTab, apiKey, itemId]);

  const fetchBlocks = async () => {
    if (!apiKey || !itemId) return;

    setLoadingBlocks(true);
    try {
      const response = await fetch(
        `/api/page-blocks?apiKey=${encodeURIComponent(apiKey)}&pageId=${encodeURIComponent(itemId)}`
      );
      const data = await response.json();

      if (data.success) {
        setBlocks(data.blocks);
      } else {
        console.error('Failed to fetch blocks:', data.error);
      }
    } catch (error) {
      console.error('Error fetching blocks:', error);
    } finally {
      setLoadingBlocks(false);
    }
  };

  const handleUpdateBlock = async (blockId: string, content: string, blockType: string) => {
    if (!apiKey || !itemId) return;

    setSavingBlock(true);
    try {
      const response = await fetch('/api/page-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          pageId: itemId,
          action: 'update',
          blockId,
          blockType,
          content,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setBlocks((prev) =>
          prev.map((b) => (b.id === blockId ? { ...b, content } : b))
        );
        setEditingBlockId(null);
        setEditingBlockContent('');
      } else {
        alert('Failed to update block: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating block:', error);
      alert('Error updating block');
    } finally {
      setSavingBlock(false);
    }
  };

  const handleCreateBlock = async () => {
    if (!apiKey || !itemId || !newBlockContent.trim()) return;

    setSavingBlock(true);
    try {
      const response = await fetch('/api/page-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          pageId: itemId,
          action: 'create',
          blockType: newBlockType,
          content: newBlockContent,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Add new block to list
        setBlocks((prev) => [
          ...prev,
          {
            id: data.blockId,
            type: newBlockType,
            content: newBlockContent,
            hasChildren: false,
            editable: true,
          },
        ]);
        setNewBlockContent('');
      } else {
        alert('Failed to create block: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating block:', error);
      alert('Error creating block');
    } finally {
      setSavingBlock(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!apiKey || !itemId) return;
    if (!confirm('Delete this block?')) return;

    setSavingBlock(true);
    try {
      const response = await fetch('/api/page-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          pageId: itemId,
          action: 'delete',
          blockId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      } else {
        alert('Failed to delete block: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting block:', error);
      alert('Error deleting block');
    } finally {
      setSavingBlock(false);
    }
  };

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

  const getBlockIcon = (type: string): string => {
    const icons: Record<string, string> = {
      paragraph: '¶',
      heading_1: 'H1',
      heading_2: 'H2',
      heading_3: 'H3',
      bulleted_list_item: '•',
      numbered_list_item: '1.',
      to_do: '☐',
      toggle: '▸',
      quote: '"',
      callout: '💡',
      code: '</>',
      divider: '—',
      image: '🖼️',
      video: '🎬',
      file: '📄',
      bookmark: '🔗',
      embed: '🌐',
    };
    return icons[type] || '📝';
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
      <div className="w-full max-w-2xl max-h-[85vh] bg-white/95 dark:bg-gray-100/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-200 dark:to-pink-200 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Edit Page
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

          {/* Tabs */}
          <div className="flex space-x-1 mt-3">
            <button
              onClick={() => setActiveTab('properties')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'properties'
                  ? 'bg-white shadow-md text-purple-700'
                  : 'text-gray-600 hover:bg-white/50'
              }`}
            >
              📋 Properties
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'content'
                  ? 'bg-white shadow-md text-purple-700'
                  : 'text-gray-600 hover:bg-white/50'
              }`}
            >
              📄 Page Content
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 bg-white dark:bg-gray-50">
          {activeTab === 'properties' ? (
            <div className="space-y-4">
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
          ) : (
            <div className="space-y-4">
              {/* Page Content Tab */}
              {loadingBlocks ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <span className="ml-3 text-gray-600">Loading page content...</span>
                </div>
              ) : blocks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No content blocks found.</p>
                  <p className="text-sm mt-1">Add content below to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      className={`group p-3 rounded-lg border transition-all ${
                        editingBlockId === block.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 shrink-0">
                          {getBlockIcon(block.type)}
                        </span>

                        {editingBlockId === block.id ? (
                          <div className="flex-1 space-y-2">
                            <textarea
                              value={editingBlockContent}
                              onChange={(e) => setEditingBlockContent(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateBlock(block.id, editingBlockContent, block.type)}
                                disabled={savingBlock}
                                className="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50"
                              >
                                {savingBlock ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingBlockId(null);
                                  setEditingBlockContent('');
                                }}
                                className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-start justify-between">
                            <p className={`text-sm ${block.content ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                              {block.content || '(empty)'}
                            </p>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {block.editable && (
                                <button
                                  onClick={() => {
                                    setEditingBlockId(block.id);
                                    setEditingBlockContent(block.content);
                                  }}
                                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteBlock(block.id)}
                                className="p-1 hover:bg-red-100 rounded text-gray-500 hover:text-red-600"
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      {!block.editable && (
                        <p className="text-xs text-gray-400 mt-1 ml-7">
                          This block type ({block.type}) can only be edited in Notion
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new block section */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Add New Block</h4>
                <div className="space-y-2">
                  <select
                    value={newBlockType}
                    onChange={(e) => setNewBlockType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="paragraph">¶ Paragraph</option>
                    <option value="heading_1">H1 Heading 1</option>
                    <option value="heading_2">H2 Heading 2</option>
                    <option value="heading_3">H3 Heading 3</option>
                    <option value="bulleted_list_item">• Bulleted List</option>
                    <option value="numbered_list_item">1. Numbered List</option>
                    <option value="quote">" Quote</option>
                    <option value="callout">💡 Callout</option>
                  </select>
                  <textarea
                    value={newBlockContent}
                    onChange={(e) => setNewBlockContent(e.target.value)}
                    placeholder="Enter content for the new block..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={2}
                  />
                  <button
                    onClick={handleCreateBlock}
                    disabled={savingBlock || !newBlockContent.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingBlock ? 'Adding...' : '+ Add Block'}
                  </button>
                </div>
              </div>
            </div>
          )}
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
            Save Properties
          </button>
        </div>
      </div>
    </div>
  );
}
