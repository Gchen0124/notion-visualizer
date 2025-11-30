'use client';

import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import NotionNode from './NotionNode';

const nodeTypes = {
  notionNode: NotionNode,
};

interface CanvasViewProps {
  apiKey: string;
  dataSourceId: string;
}

export default function CanvasView({ apiKey, dataSourceId }: CanvasViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [items, setItems] = useState<any[]>([]);
  const [schema, setSchema] = useState<any[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());

  // Fetch database items
  useEffect(() => {
    async function fetchData() {
      try {
        console.log('[CanvasView] Fetching with apiKey:', apiKey);
        console.log('[CanvasView] apiKey length:', apiKey.length);
        console.log('[CanvasView] apiKey first 10 chars:', apiKey.substring(0, 10));
        console.log('[CanvasView] apiKey last 10 chars:', apiKey.substring(apiKey.length - 10));

        const response = await fetch(
          `/api/canvas?apiKey=${encodeURIComponent(apiKey)}&dataSourceId=${encodeURIComponent(dataSourceId)}`
        );
        const data = await response.json();

        if (data.error) {
          console.error('Error fetching data:', data.error);
          return;
        }

        setItems(data.items);
        setSchema(data.schema);

        // Auto-select first few properties
        const defaultProps = data.schema
          .filter((s: any) => !['title', 'rich_text'].includes(s.type))
          .slice(0, 3)
          .map((s: any) => s.name);
        setSelectedProperties(defaultProps);
      } catch (error) {
        console.error('Failed to fetch database:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [apiKey, dataSourceId]);

  // Toggle sub-items visibility
  const toggleSubItems = useCallback(
    (nodeId: string) => {
      const childEdges = edges.filter((e) => e.source === nodeId);
      const childIds = childEdges.map((e) => e.target);

      setHiddenNodes((hidden) => {
        const newHidden = new Set(hidden);
        const childrenVisible = !childIds.some((id) => hidden.has(id));

        if (childrenVisible) {
          // Hide children
          childIds.forEach((id) => newHidden.add(id));
        } else {
          // Show children
          childIds.forEach((id) => newHidden.delete(id));
        }

        return newHidden;
      });

      // Update node to reflect visibility state
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  childrenVisible: !childIds.some((id) => hiddenNodes.has(id)),
                },
              }
            : node
        )
      );
    },
    [edges, hiddenNodes, setNodes]
  );

  // Add item to canvas
  const addItemToCanvas = useCallback(
    (item: any) => {
      const titleProp = Object.keys(item.properties).find((key) =>
        key.toLowerCase().includes('title') || key.toLowerCase().includes('name')
      );
      const title = item.properties[titleProp || Object.keys(item.properties)[0]] || 'Untitled';

      // Check if this item has children
      const hasChildren = edges.some((e) => e.source === item.id);
      const childrenVisible = edges
        .filter((e) => e.source === item.id)
        .every((e) => !hiddenNodes.has(e.target));

      const newNode: Node = {
        id: item.id,
        type: 'notionNode',
        position: { x: Math.random() * 400, y: Math.random() * 400 },
        data: {
          label: title,
          properties: item.properties,
          color: item.properties.canvas_color || '#9333ea',
          visibleProperties: selectedProperties,
          hasChildren,
          childrenVisible,
          onUpdateTitle: (newTitle: string) => {
            updateItemProperty(item.id, titleProp || 'title', newTitle);
          },
          onUpdateProperty: (propName: string, value: any) => {
            updateItemProperty(item.id, propName, value);
          },
          onUpdateColor: (color: string) => {
            updateItemProperty(item.id, 'canvas_color', color);
            setNodes((nds) =>
              nds.map((node) =>
                node.id === item.id
                  ? { ...node, data: { ...node.data, color } }
                  : node
              )
            );
          },
          onToggleSubItems: () => toggleSubItems(item.id),
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setShowSearch(false);
      setSearchTerm('');
    },
    [selectedProperties, edges, hiddenNodes, setNodes, toggleSubItems]
  );

  // Update item property
  const updateItemProperty = async (itemId: string, propName: string, value: any) => {
    try {
      await fetch('/api/canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          dataSourceId,
          action: 'update',
          itemId,
          properties: { [propName]: value },
        }),
      });

      // Update local state
      setItems((items) =>
        items.map((item) =>
          item.id === itemId
            ? { ...item, properties: { ...item.properties, [propName]: value } }
            : item
        )
      );
    } catch (error) {
      console.error('Failed to update property:', error);
    }
  };

  // Create new item
  const createNewItem = async () => {
    const titleProp = schema.find((s) => s.type === 'title')?.name || 'Name';
    const newTitle = searchTerm || 'New Item';

    try {
      const response = await fetch('/api/canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          dataSourceId,
          action: 'create',
          properties: { [titleProp]: newTitle },
        }),
      });

      const result = await response.json();
      if (result.success) {
        const newItem = {
          id: result.itemId,
          properties: { [titleProp]: newTitle },
        };
        setItems((items) => [...items, newItem]);
        addItemToCanvas(newItem);
      }
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  };

  // Handle node drop for nesting
  const onConnect = useCallback(
    async (connection: Connection) => {
      const edge: Edge = {
        ...connection,
        id: `${connection.source}-${connection.target}`,
        type: 'smoothstep',
      };
      setEdges((eds) => addEdge(edge, eds));

      // Update parent-child relationship in Notion
      // Assuming you have a "Parent" relation property in your database
      if (connection.source && connection.target) {
        try {
          await fetch('/api/canvas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey,
              dataSourceId,
              action: 'update',
              itemId: connection.target,
              properties: {
                Parent: [connection.source], // Relation property
              },
            }),
          });

          // Update node to show it has a parent
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === connection.source) {
                return {
                  ...node,
                  data: { ...node.data, hasChildren: true },
                };
              }
              return node;
            })
          );
        } catch (error) {
          console.error('Failed to create parent-child relationship:', error);
        }
      }
    },
    [setEdges, apiKey, dataSourceId, setNodes]
  );

  // Handle edge deletion (unnesting)
  const onEdgesDelete = useCallback(
    async (edgesToDelete: Edge[]) => {
      for (const edge of edgesToDelete) {
        try {
          // Remove parent relationship in Notion
          await fetch('/api/canvas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey,
              dataSourceId,
              action: 'update',
              itemId: edge.target,
              properties: {
                Parent: [], // Clear relation
              },
            }),
          });

          // Check if source node still has other children
          const remainingChildren = edges.filter(
            (e) => e.source === edge.source && e.id !== edge.id
          );

          if (remainingChildren.length === 0) {
            setNodes((nds) =>
              nds.map((node) =>
                node.id === edge.source
                  ? { ...node, data: { ...node.data, hasChildren: false } }
                  : node
              )
            );
          }
        } catch (error) {
          console.error('Failed to remove parent-child relationship:', error);
        }
      }
    },
    [apiKey, dataSourceId, edges, setNodes]
  );

  const filteredItems = items.filter((item) => {
    const titleProp = Object.keys(item.properties).find((key) =>
      key.toLowerCase().includes('title') || key.toLowerCase().includes('name')
    );
    const title = item.properties[titleProp || Object.keys(item.properties)[0]] || '';
    return title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-lg">Loading database...</div>
      </div>
    );
  }

  return (
    <div className="h-screen relative">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 space-y-2">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="px-4 py-2 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-lg shadow-lg hover:shadow-xl transition-all border border-white/20"
        >
          🔍 Add Item
        </button>

        {showSearch && (
          <div className="bg-white/90 dark:bg-black/50 backdrop-blur-md rounded-lg shadow-xl p-4 w-80 border border-white/20">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search or create new..."
              className="w-full px-3 py-2 bg-white/50 dark:bg-black/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 mb-2"
            />

            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredItems.length === 0 ? (
                <button
                  onClick={createNewItem}
                  className="w-full px-3 py-2 text-left hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
                >
                  ✨ Create "{searchTerm || 'New Item'}"
                </button>
              ) : (
                filteredItems.map((item) => {
                  const titleProp = Object.keys(item.properties).find((key) =>
                    key.toLowerCase().includes('title') || key.toLowerCase().includes('name')
                  );
                  const title = item.properties[titleProp || Object.keys(item.properties)[0]];

                  return (
                    <button
                      key={item.id}
                      onClick={() => addItemToCanvas(item)}
                      className="w-full px-3 py-2 text-left hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors text-sm"
                    >
                      {title}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Property selector */}
      <div className="absolute top-4 right-4 z-10 bg-white/90 dark:bg-black/50 backdrop-blur-md rounded-lg shadow-xl p-4 w-64 border border-white/20">
        <h3 className="font-semibold mb-2 text-sm">Visible Properties</h3>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {schema.map((prop) => (
            <label key={prop.name} className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={selectedProperties.includes(prop.name)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedProperties([...selectedProperties, prop.name]);
                  } else {
                    setSelectedProperties(selectedProperties.filter((p) => p !== prop.name));
                  }
                }}
                className="rounded"
              />
              <span>{prop.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes.filter((node) => !hiddenNodes.has(node.id))}
        edges={edges.filter(
          (edge) => !hiddenNodes.has(edge.source) && !hiddenNodes.has(edge.target)
        )}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Delete"
        className="bg-gradient-to-br from-purple-50/50 via-pink-50/50 to-blue-50/50 dark:from-gray-900/50 dark:via-purple-900/50 dark:to-pink-900/50"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
