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
import PropertyEditorModal from './PropertyEditorModal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: any = {
  notionNode: NotionNode,
};

interface CanvasViewProps {
  apiKey: string;
  dataSourceId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppNode = Node<any, string>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppEdge = Edge<any>;

export default function CanvasView({ apiKey, dataSourceId }: CanvasViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge>([]);
  const [items, setItems] = useState<any[]>([]);
  const [schema, setSchema] = useState<any[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
  const [canvasBgGradientStart, setCanvasBgGradientStart] = useState(
    localStorage.getItem('canvas_bg_gradient_start') || '#fff25c'
  );
  const [canvasBgGradientEnd, setCanvasBgGradientEnd] = useState(
    localStorage.getItem('canvas_bg_gradient_end') || '#ffc7fa'
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showSaveView, setShowSaveView] = useState(false);
  const [showLoadView, setShowLoadView] = useState(false);
  const [savedViews, setSavedViews] = useState<{id?: string, name: string, itemIds: string[]}[]>([]);
  const [viewsSource, setViewsSource] = useState<'notion' | 'local'>('local');

  // Load saved views - try Notion first, fallback to localStorage
  useEffect(() => {
    async function loadViews() {
      try {
        // Try fetching from Notion first
        const response = await fetch(`/api/canvas-views?apiKey=${encodeURIComponent(apiKey)}`);
        const result = await response.json();

        if (result.success && result.views && result.views.length > 0) {
          console.log('[CanvasView] Loaded views from Notion:', result.views.length);
          setSavedViews(result.views);
          setViewsSource('notion');
          // Also sync to localStorage as backup
          localStorage.setItem(`canvas_views_${dataSourceId}`, JSON.stringify(result.views));
          return;
        }
      } catch (error) {
        console.warn('[CanvasView] Failed to fetch views from Notion, falling back to localStorage:', error);
      }

      // Fallback to localStorage
      const saved = localStorage.getItem(`canvas_views_${dataSourceId}`);
      if (saved) {
        console.log('[CanvasView] Loaded views from localStorage');
        setSavedViews(JSON.parse(saved));
        setViewsSource('local');
      }
    }

    loadViews();
  }, [apiKey, dataSourceId]);

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

  // Toggle sub-items visibility within the block
  const toggleSubItems = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const currentVisibility = node.data.childrenVisible ?? true;
            return {
              ...node,
              data: {
                ...node.data,
                childrenVisible: !currentVisibility,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  // Toggle image background visibility
  const toggleImage = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const currentShowImage = node.data.showImage ?? false;
            return {
              ...node,
              data: {
                ...node.data,
                showImage: !currentShowImage,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  // Calculate node height based on sub-items
  const calculateNodeHeight = useCallback((subItemCount: number) => {
    const baseHeight = 180;
    const headerHeight = 60;
    const subItemHeight = 45;
    const padding = 20;
    const calculatedHeight = headerHeight + padding + (subItemCount * subItemHeight) + (subItemCount > 0 ? 40 : 40);
    return Math.max(180, calculatedHeight); // No max cap, let it grow
  }, []);

  // Refresh node's sub-items
  const refreshNodeSubItems = useCallback((nodeId: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          // Find the updated item in items state
          const updatedItem = items.find((i) => i.id === nodeId);
          if (!updatedItem) return node;

          // Get sub-item count from Sub-item property
          const subItemIds = Array.isArray(updatedItem.properties['Sub-item'])
            ? updatedItem.properties['Sub-item']
            : [];

          // Calculate new height
          const newHeight = calculateNodeHeight(subItemIds.length);

          return {
            ...node,
            style: { ...node.style, height: newHeight },
            data: {
              ...node.data,
              properties: updatedItem.properties, // Update properties to reflect new Sub-item array
              allItems: items, // Update allItems with latest state
            },
          };
        }
        return node;
      })
    );
  }, [items, setNodes, calculateNodeHeight]);

  // Add item to canvas
  const addItemToCanvas = useCallback(
    (item: any) => {
      // Check if item is already on canvas
      if (nodes.some((node) => node.id === item.id)) {
        console.log('[CanvasView] Item already on canvas:', item.id);
        return;
      }

      // Use schema to find the correct title property
      const titleProp = schema.find((s) => s.type === 'title')?.name ||
                        Object.keys(item.properties).find((key) =>
                          key.toLowerCase().includes('title') || key.toLowerCase().includes('name') || key.toLowerCase().includes('plan')
                        );
      const title = item.properties[titleProp || Object.keys(item.properties)[0]] || 'Untitled';

      console.log('[CanvasView] Adding item to canvas:', item.id, 'Title:', title, 'TitleProp:', titleProp);

      // Check if this item has children (from Sub-item property or edges)
      const subItemIds = Array.isArray(item.properties['Sub-item']) ? item.properties['Sub-item'] : [];
      const hasChildren = edges.some((e) => e.source === item.id) || subItemIds.length > 0;
      // Default to showing sub-items (true)
      const childrenVisible = true;

      // Use saved canvas position or random position
      // Validate saved position - only use if it's reasonable (within visible canvas range)
      const savedX = item.properties.canvas_x;
      const savedY = item.properties.canvas_y;
      const isValidPosition = (
        savedX !== null && savedX !== undefined &&
        savedY !== null && savedY !== undefined &&
        savedX >= -500 && savedX <= 3000 &&
        savedY >= -500 && savedY <= 3000
      );

      // Generate better spread positions for new items
      const existingNodeCount = nodes.length;
      const spreadX = (existingNodeCount % 4) * 300; // Spread horizontally
      const spreadY = Math.floor(existingNodeCount / 4) * 250; // Spread vertically after 4 items

      const position = isValidPosition
        ? { x: savedX, y: savedY }
        : { x: 100 + spreadX, y: 100 + spreadY };

      console.log('[CanvasView] Item position - savedX:', savedX, 'savedY:', savedY, 'isValidPosition:', isValidPosition, 'final position:', position);

      // Get gradient colors or fallback to default white gradient
      const gradientStart = item.properties.canvas_gradient_start;
      const gradientEnd = item.properties.canvas_gradient_end;
      const gradientColors = (gradientStart && gradientEnd)
        ? { start: gradientStart, end: gradientEnd }
        : { start: '#ffffff', end: '#ededed' };

      // Calculate height based on number of sub-items
      const nodeHeight = calculateNodeHeight(subItemIds.length);

      const newNode: AppNode = {
        id: item.id,
        type: 'notionNode',
        position,
        style: { width: 250, height: nodeHeight },
        data: {
          label: title,
          properties: item.properties,
          color: item.properties.canvas_color || '#ffffff',
          gradientColors,
          visibleProperties: [], // Hide properties on node
          hasChildren,
          childrenVisible,
          titleProp,
          allItems: items,
          onUpdateTitle: (newTitle: string) => {
            updateItemProperty(item.id, titleProp || 'Task Plan', newTitle);
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
          onUpdateGradient: (start: string, end: string) => {
            updateItemProperty(item.id, 'canvas_gradient_start', start);
            updateItemProperty(item.id, 'canvas_gradient_end', end);
            setNodes((nds) =>
              nds.map((node) =>
                node.id === item.id
                  ? { ...node, data: { ...node.data, gradientColors: { start, end } } }
                  : node
              )
            );
          },
          onToggleSubItems: () => toggleSubItems(item.id),
          onToggleImage: () => toggleImage(item.id),
          onOpenPropertyEditor: () => setEditingItemId(item.id),
          onAddSubItem: async () => {
            const subItemTitle = prompt('Enter sub-item title:');
            if (subItemTitle) {
              await createSubItem(item.id, subItemTitle);
            }
          },
          onDeleteSubItem: async (subItemId: string) => {
            await deleteSubItem(subItemId, item.id);
          },
          onReorderSubItems: async (subItemId: string, direction: 'up' | 'down') => {
            await reorderSubItem(item.id, subItemId, direction);
          },
        },
      };

      console.log('[CanvasView] Current nodes count before adding:', nodes.length);
      console.log('[CanvasView] About to add node:', newNode.id, 'at position:', newNode.position);

      setNodes((nds) => {
        const updatedNodes = [...nds, newNode];
        console.log('[CanvasView] Nodes count after adding:', updatedNodes.length);
        return updatedNodes;
      });

      setShowSearch(false);
      setSearchTerm('');
    },
    [schema, selectedProperties, edges, hiddenNodes, items, nodes, setNodes, toggleSubItems, toggleImage, calculateNodeHeight]
  );

  // Update item property
  const updateItemProperty = async (itemId: string, propName: string, value: any) => {
    try {
      console.log('[CanvasView] Updating property:', propName, 'for item:', itemId, 'value:', value);

      const response = await fetch('/api/canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          dataSourceId,
          action: 'update',
          itemId,
          properties: { [propName]: value },
          schema, // Pass schema for proper formatting
        }),
      });

      const result = await response.json();

      if (!result.success) {
        console.error('[CanvasView] Failed to update property:', result.error);
        alert(`Failed to update property: ${result.error}`);
        return;
      }

      console.log('[CanvasView] Property update successful');

      // Update local state
      setItems((items) =>
        items.map((item) =>
          item.id === itemId
            ? { ...item, properties: { ...item.properties, [propName]: value } }
            : item
        )
      );

      // Also update node data if it exists
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === itemId) {
            const updatedData = {
              ...node.data,
              properties: { ...node.data.properties, [propName]: value }
            };
            // If updating the title property, also update the label
            const titleProp = schema.find((s) => s.type === 'title')?.name;
            if (propName === titleProp) {
              updatedData.label = value;
            }
            return { ...node, data: updatedData };
          }
          return node;
        })
      );
    } catch (error) {
      console.error('[CanvasView] Failed to update property:', error);
      alert(`Failed to update property: ${error}`);
    }
  };

  // Create new item
  const createNewItem = async () => {
    const titleProp = schema.find((s) => s.type === 'title')?.name || 'Name';
    const newTitle = searchTerm || 'New Item';

    console.log('[CanvasView] Creating item with titleProp:', titleProp, 'value:', newTitle);
    console.log('[CanvasView] Schema:', schema);

    try {
      const response = await fetch('/api/canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          dataSourceId,
          action: 'create',
          properties: { [titleProp]: newTitle },
          schema, // Pass schema for proper formatting
        }),
      });

      const result = await response.json();
      console.log('[CanvasView] Create result:', result);

      if (result.success) {
        const newItem = {
          id: result.itemId,
          properties: { [titleProp]: newTitle },
          url: '', // Add url property even if empty
        };
        setItems((items) => [...items, newItem]);
        addItemToCanvas(newItem);
        setSearchTerm('');
        setShowSearch(false); // Close search dropdown after creating
      } else if (result.error) {
        console.error('Failed to create item:', result.error);
        alert(`Failed to create item: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to create item:', error);
      alert(`Failed to create item: ${error}`);
    }
  };

  // Create sub-item
  const createSubItem = async (parentId: string, subItemTitle: string) => {
    const titleProp = schema.find((s) => s.type === 'title')?.name || 'Name';

    console.log('[CanvasView] Creating sub-item with title:', subItemTitle, 'for parent:', parentId);

    try {
      const response = await fetch('/api/canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          dataSourceId,
          action: 'create',
          properties: {
            [titleProp]: subItemTitle,
            'Parent item': [parentId], // Set parent relationship
          },
          schema,
        }),
      });

      const result = await response.json();
      console.log('[CanvasView] Create sub-item result:', result);

      if (result.success) {
        const newSubItem = {
          id: result.itemId,
          properties: {
            [titleProp]: subItemTitle,
            'Parent item': [parentId],
          },
          url: '',
        };

        // Update parent's Sub-item property to include the new sub-item
        // Use functional form to get latest state
        let finalUpdatedSubItems: string[] = [];
        let finalUpdatedItems: any[] = [];

        setItems((currentItems) => {
          const parentItem = currentItems.find((i) => i.id === parentId);
          if (!parentItem) {
            finalUpdatedItems = [...currentItems, newSubItem];
            return finalUpdatedItems;
          }

          const currentSubItems = Array.isArray(parentItem.properties['Sub-item'])
            ? parentItem.properties['Sub-item']
            : [];
          finalUpdatedSubItems = [...currentSubItems, result.itemId];

          // Update parent in Notion (async, don't await here)
          updateItemProperty(parentId, 'Sub-item', finalUpdatedSubItems);

          // Update local state with both the new sub-item and updated parent
          finalUpdatedItems = currentItems.map((item) =>
            item.id === parentId
              ? { ...item, properties: { ...item.properties, 'Sub-item': finalUpdatedSubItems } }
              : item
          ).concat([newSubItem]);

          return finalUpdatedItems;
        });

        // Immediately update the node with new data
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === parentId) {
              const newHeight = calculateNodeHeight(finalUpdatedSubItems.length);
              return {
                ...node,
                style: { ...node.style, height: newHeight },
                data: {
                  ...node.data,
                  properties: {
                    ...node.data.properties,
                    'Sub-item': finalUpdatedSubItems,
                  },
                  allItems: finalUpdatedItems,
                },
              };
            }
            return node;
          })
        );
      } else {
        console.error('Failed to create sub-item:', result.error);
        alert(`Failed to create sub-item: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to create sub-item:', error);
      alert(`Failed to create sub-item: ${error}`);
    }
  };

  // Delete sub-item
  const deleteSubItem = async (subItemId: string, parentId: string) => {
    console.log('[CanvasView] Deleting sub-item:', subItemId);

    try {
      const response = await fetch('/api/canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          dataSourceId,
          action: 'delete',
          itemId: subItemId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Update parent's Sub-item property to remove the deleted sub-item
        const parentItem = items.find((i) => i.id === parentId);
        if (parentItem) {
          const currentSubItems = Array.isArray(parentItem.properties['Sub-item'])
            ? parentItem.properties['Sub-item']
            : [];
          const updatedSubItems = currentSubItems.filter((id: string) => id !== subItemId);

          // Update parent in Notion
          await updateItemProperty(parentId, 'Sub-item', updatedSubItems);

          // Update local state
          const updatedItems = items
            .filter((item) => item.id !== subItemId)
            .map((item) =>
              item.id === parentId
                ? { ...item, properties: { ...item.properties, 'Sub-item': updatedSubItems } }
                : item
            );

          setItems(updatedItems);

          // Immediately update the node with new data
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === parentId) {
                const newHeight = calculateNodeHeight(updatedSubItems.length);
                return {
                  ...node,
                  style: { ...node.style, height: newHeight },
                  data: {
                    ...node.data,
                    properties: { ...parentItem.properties, 'Sub-item': updatedSubItems },
                    allItems: updatedItems,
                  },
                };
              }
              return node;
            })
          );
        } else {
          setItems((items) => items.filter((item) => item.id !== subItemId));
        }
      } else {
        console.error('Failed to delete sub-item:', result.error);
        alert(`Failed to delete sub-item: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to delete sub-item:', error);
      alert(`Failed to delete sub-item: ${error}`);
    }
  };

  // Reorder sub-items
  const reorderSubItem = async (parentId: string, subItemId: string, direction: 'up' | 'down') => {
    console.log('[CanvasView] Reordering sub-item:', subItemId, 'direction:', direction);

    // Get current sub-items
    const titleProp = schema.find((s) => s.type === 'title')?.name;
    const currentSubItems = items
      .filter((i) => {
        const parentIds = i.properties['Parent item'] || [];
        return Array.isArray(parentIds) && parentIds.includes(parentId);
      })
      .sort((a, b) => {
        // Sort by some order property if exists, otherwise by id
        const orderA = a.properties.order || 0;
        const orderB = b.properties.order || 0;
        return orderA - orderB;
      });

    const currentIndex = currentSubItems.findIndex((item) => item.id === subItemId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= currentSubItems.length) return;

    // Swap items
    const reorderedItems = [...currentSubItems];
    [reorderedItems[currentIndex], reorderedItems[newIndex]] =
      [reorderedItems[newIndex], reorderedItems[currentIndex]];

    // Update order property for all sub-items
    try {
      for (let i = 0; i < reorderedItems.length; i++) {
        await updateItemProperty(reorderedItems[i].id, 'order', i);
      }

      // Update local state
      setItems((items) =>
        items.map((item) => {
          const idx = reorderedItems.findIndex((ri) => ri.id === item.id);
          if (idx !== -1) {
            return { ...item, properties: { ...item.properties, order: idx } };
          }
          return item;
        })
      );

      // Refresh the parent node
      setTimeout(() => refreshNodeSubItems(parentId), 100);
    } catch (error) {
      console.error('Failed to reorder sub-items:', error);
      alert(`Failed to reorder sub-items: ${error}`);
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
                'Parent item': [connection.source], // Relation property
              },
              schema,
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
    [setEdges, apiKey, dataSourceId, setNodes, schema]
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
                'Parent item': [], // Clear relation
              },
              schema,
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
    [apiKey, dataSourceId, edges, setNodes, schema]
  );

  const filteredItems = items.filter((item) => {
    // Filter out items already on canvas
    const isOnCanvas = nodes.some((node) => node.id === item.id);
    if (isOnCanvas) {
      return false;
    }

    // Use schema to find the actual title property
    const titleProp = schema.find((s) => s.type === 'title')?.name ||
                      Object.keys(item.properties).find((key) =>
                        key.toLowerCase().includes('title') || key.toLowerCase().includes('name') || key.toLowerCase().includes('plan')
                      );
    const title = item.properties[titleProp || Object.keys(item.properties)[0]] || '';
    return title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Save current view - save to Notion first, then localStorage
  const saveCurrentView = async () => {
    const viewName = prompt('Enter a name for this view:');
    if (!viewName) return;

    const currentItemIds = nodes.map(n => n.id);

    // Collect current positions of all items on canvas
    const itemPositions = nodes.map(node => ({
      id: node.id,
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
      width: node.style?.width ? Number(node.style.width) : undefined,
      color: node.data.color,
      gradientStart: node.data.gradientColors?.start,
      gradientEnd: node.data.gradientColors?.end,
    }));

    // Check if view with same name exists
    const existingView = savedViews.find(v => v.name === viewName);

    try {
      // Save to Notion first (including positions)
      const response = await fetch('/api/canvas-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey, // Pass the API key
          name: viewName,
          itemIds: currentItemIds,
          existingViewId: existingView?.id, // Update if exists
          itemPositions, // Include positions for each item
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('[CanvasView] Saved view to Notion:', viewName, 'with', itemPositions.length, 'item positions');

        // Update local state with Notion view ID
        const newView = { id: result.viewId, name: viewName, itemIds: currentItemIds };

        let updatedViews;
        if (existingView) {
          // Update existing view
          updatedViews = savedViews.map(v =>
            v.name === viewName ? newView : v
          );
        } else {
          // Add new view
          updatedViews = [...savedViews, newView];
        }

        setSavedViews(updatedViews);
        setViewsSource('notion');

        // Also save to localStorage as backup
        localStorage.setItem(`canvas_views_${dataSourceId}`, JSON.stringify(updatedViews));

        alert(`View "${viewName}" saved with ${currentItemIds.length} items and their positions!`);
      } else {
        throw new Error(result.error || 'Failed to save to Notion');
      }
    } catch (error: any) {
      console.warn('[CanvasView] Failed to save to Notion, saving to localStorage only:', error);

      // Fallback: save to localStorage only
      const newView = { name: viewName, itemIds: currentItemIds };
      const updatedViews = existingView
        ? savedViews.map(v => v.name === viewName ? newView : v)
        : [...savedViews, newView];

      setSavedViews(updatedViews);
      setViewsSource('local');
      localStorage.setItem(`canvas_views_${dataSourceId}`, JSON.stringify(updatedViews));

      alert(`View "${viewName}" saved locally (Notion sync failed: ${error.message})`);
    }
  };

  // Load a saved view
  const loadView = async (view: {id?: string, name: string, itemIds: string[]}) => {
    // Clear current canvas
    setNodes([]);
    setEdges([]);
    setShowLoadView(false);

    // If view has a Notion ID, fetch full item data with positions from Notion
    if (view.id) {
      try {
        console.log(`[CanvasView] Fetching view "${view.name}" from Notion with positions...`);

        const response = await fetch(`/api/canvas-views?apiKey=${encodeURIComponent(apiKey)}&viewId=${encodeURIComponent(view.id)}`);
        const result = await response.json();

        if (result.success && result.view) {
          const viewData = result.view;
          console.log(`[CanvasView] Fetched ${viewData.items.length} items with positions`);

          // Add items to canvas with their saved positions
          viewData.items.forEach((notionItem: any) => {
            // Create an item object that matches the expected format
            const item = {
              id: notionItem.id,
              properties: notionItem.properties,
              url: '',
            };

            // The addItemToCanvas function will use canvas_x, canvas_y from properties
            addItemToCanvas(item);
          });

          console.log(`[CanvasView] Loaded view "${view.name}" with ${viewData.items.length} items from Notion`);
          return;
        } else {
          console.warn('[CanvasView] Failed to fetch from Notion, falling back to local items:', result.error);
        }
      } catch (error) {
        console.warn('[CanvasView] Error fetching from Notion, falling back to local items:', error);
      }
    }

    // Fallback: Add items from local state (without Notion positions)
    view.itemIds.forEach(itemId => {
      const item = items.find(i => i.id === itemId);
      if (item) {
        addItemToCanvas(item);
      }
    });

    console.log(`[CanvasView] Loaded view "${view.name}" with ${view.itemIds.length} items (local fallback)`);
  };

  // Delete a saved view - delete from Notion first, then localStorage
  const deleteView = async (viewName: string) => {
    if (!confirm(`Delete view "${viewName}"?`)) return;

    const viewToDelete = savedViews.find(v => v.name === viewName);
    const updatedViews = savedViews.filter(v => v.name !== viewName);

    // If view has a Notion ID, delete from Notion first
    if (viewToDelete?.id) {
      try {
        const response = await fetch(`/api/canvas-views?apiKey=${encodeURIComponent(apiKey)}&viewId=${encodeURIComponent(viewToDelete.id)}`, {
          method: 'DELETE',
        });

        const result = await response.json();

        if (result.success) {
          console.log('[CanvasView] Deleted view from Notion:', viewName);
        } else {
          console.warn('[CanvasView] Failed to delete from Notion:', result.error);
        }
      } catch (error) {
        console.warn('[CanvasView] Failed to delete from Notion:', error);
      }
    }

    // Update local state and localStorage
    setSavedViews(updatedViews);
    localStorage.setItem(`canvas_views_${dataSourceId}`, JSON.stringify(updatedViews));
    console.log('[CanvasView] View deleted:', viewName);
  };

  console.log('[CanvasView] Total items:', items.length, 'Nodes on canvas:', nodes.length, 'Filtered items:', filteredItems.length);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-lg">Loading database...</div>
      </div>
    );
  }

  return (
    <div className="h-screen relative">
      {/* Compact Toolbar */}
      <div className="absolute top-4 left-4 z-10 space-y-1.5">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="px-3 py-1.5 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-lg shadow-lg hover:shadow-xl transition-all border border-white/20 text-sm"
        >
          🔍 Add Item
        </button>

        <button
          onClick={saveCurrentView}
          className="px-3 py-1.5 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-lg shadow-lg hover:shadow-xl transition-all border border-white/20 text-sm"
        >
          💾 Save View
        </button>

        <button
          onClick={() => setShowLoadView(!showLoadView)}
          className="px-3 py-1.5 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-lg shadow-lg hover:shadow-xl transition-all border border-white/20 text-sm"
        >
          📂 Load View ({savedViews.length})
        </button>

        {/* Canvas Background Color Picker - Compact */}
        <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-lg shadow-lg p-2 border border-white/20">
          <h3 className="font-semibold mb-1.5 text-xs">Canvas BG</h3>
          <div className="space-y-1.5">
            <input
              type="color"
              value={canvasBgGradientStart}
              onChange={(e) => {
                setCanvasBgGradientStart(e.target.value);
                localStorage.setItem('canvas_bg_gradient_start', e.target.value);
              }}
              className="w-full h-7 rounded cursor-pointer border border-gray-300"
              title="Gradient Start"
            />
            <input
              type="color"
              value={canvasBgGradientEnd}
              onChange={(e) => {
                setCanvasBgGradientEnd(e.target.value);
                localStorage.setItem('canvas_bg_gradient_end', e.target.value);
              }}
              className="w-full h-7 rounded cursor-pointer border border-gray-300"
              title="Gradient End"
            />
          </div>
        </div>

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
              {/* Show create button if there's a search term */}
              {searchTerm && (
                <button
                  onClick={createNewItem}
                  className="w-full px-3 py-2 text-left hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors font-semibold text-purple-600 dark:text-purple-400 border-b border-purple-200 dark:border-purple-800 mb-1"
                >
                  ✨ Create "{searchTerm}"
                </button>
              )}

              {/* Show filtered items */}
              {filteredItems.length === 0 && !searchTerm ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  Start typing to search or create...
                </div>
              ) : (
                filteredItems.map((item) => {
                  const titleProp = schema.find((s) => s.type === 'title')?.name ||
                                    Object.keys(item.properties).find((key) =>
                                      key.toLowerCase().includes('title') || key.toLowerCase().includes('name') || key.toLowerCase().includes('plan')
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

        {showLoadView && (
          <div className="bg-white/90 dark:bg-black/50 backdrop-blur-md rounded-lg shadow-xl p-4 w-80 border border-white/20">
            <h3 className="font-semibold mb-3 text-sm">Saved Views</h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {savedViews.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                  No saved views yet. Save your current canvas layout!
                </div>
              ) : (
                savedViews.map((view) => (
                  <div
                    key={view.name}
                    className="flex items-center justify-between p-2 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
                  >
                    <button
                      onClick={() => loadView(view)}
                      className="flex-1 text-left text-sm font-medium"
                    >
                      {view.name} ({view.itemIds.length} items)
                    </button>
                    <button
                      onClick={() => deleteView(view.name)}
                      className="ml-2 px-2 py-1 text-xs bg-red-500/80 hover:bg-red-600 text-white rounded transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes.filter((node) => !hiddenNodes.has(node.id))}
        edges={edges.filter(
          (edge) => !hiddenNodes.has(edge.source) && !hiddenNodes.has(edge.target)
        )}
        onNodesChange={(changes) => {
          onNodesChange(changes);

          // Save position changes to Notion
          changes.forEach((change) => {
            if (change.type === 'position' && change.position && !change.dragging) {
              const node = nodes.find((n) => n.id === change.id);
              if (node) {
                console.log('[CanvasView] Saving position for', change.id, 'x:', Math.round(change.position.x), 'y:', Math.round(change.position.y));
                updateItemProperty(change.id, 'canvas_x', Math.round(change.position.x));
                updateItemProperty(change.id, 'canvas_y', Math.round(change.position.y));
              }
            }
          });
        }}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Delete"
        style={{
          background: `linear-gradient(to bottom right, ${canvasBgGradientStart}, ${canvasBgGradientEnd})`,
        }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* Property Editor Modal */}
      {editingItemId && (() => {
        const editingItem = items.find((item) => item.id === editingItemId);
        return editingItem ? (
          <PropertyEditorModal
            isOpen={true}
            onClose={() => setEditingItemId(null)}
            itemId={editingItemId}
            properties={editingItem.properties}
            schema={schema}
            allItems={items}
            pageUrl={editingItem.url}
            onUpdateProperty={(propName: string, value: any) => {
              updateItemProperty(editingItemId, propName, value);
            }}
          />
        ) : null;
      })()}
    </div>
  );
}
