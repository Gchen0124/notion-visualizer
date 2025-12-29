'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Connection,
  Edge,
  Node,
  Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import NotionNode from './NotionNode';
import PropertyEditorModal from './PropertyEditorModal';
import CanvasViewSetupGuide from './CanvasViewSetupGuide';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: any = {
  notionNode: NotionNode,
};

interface CanvasViewProps {
  apiKey: string;
  dataSourceId: string;
  canvasViewDbId?: string;   // Canvas View database ID for saving/loading views
  taskCalendarDbId?: string; // Task Calendar database ID for creating Canvas View DB
  onShowSettings?: () => void;
  defaultViewId?: string;  // Auto-load this view on mount (for demo mode)
  isDemoMode?: boolean;    // Show demo-specific UI hints
}

// Interface for saved view with optional viewport and positions
interface SavedView {
  id?: string;
  name: string;
  itemIds: string[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  // Local-only: positions for each item (used when Notion sync fails)
  itemPositions?: Array<{
    id: string;
    x: number;
    y: number;
    color?: string;
    gradientStart?: string;
    gradientEnd?: string;
  }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppNode = Node<any, string>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppEdge = Edge<any>;

function CanvasViewInner({ apiKey, dataSourceId, canvasViewDbId: initialCanvasViewDbId, taskCalendarDbId, onShowSettings, defaultViewId, isDemoMode = false }: CanvasViewProps) {
  // Use ReactFlow hook to access viewport (requires ReactFlowProvider wrapper)
  const reactFlowInstance = useReactFlow();
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
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewsSource, setViewsSource] = useState<'notion' | 'local'>('local');
  const [hasLoadedInitialView, setHasLoadedInitialView] = useState(false);
  const [hasRestoredViewport, setHasRestoredViewport] = useState(false);

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [nodesToDelete, setNodesToDelete] = useState<AppNode[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Canvas View setup guide state
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [hasSeenSetupGuide, setHasSeenSetupGuide] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hasSeenCanvasViewSetupGuide') === 'true';
    }
    return false;
  });
  const [pendingSaveAction, setPendingSaveAction] = useState(false);

  // Canvas View database ID (can be updated if created on first save)
  const [canvasViewDbId, setCanvasViewDbId] = useState<string | undefined>(initialCanvasViewDbId);
  const [isCreatingCanvasViewDb, setIsCreatingCanvasViewDb] = useState(false);

  // Load saved views - try Notion first, fallback to localStorage
  useEffect(() => {
    async function loadViews() {
      try {
        // Try fetching from Notion first (pass canvasViewDb if available)
        const params = new URLSearchParams({ apiKey });
        if (canvasViewDbId) {
          params.append('canvasViewDb', canvasViewDbId);
        }
        const response = await fetch(`/api/canvas-views?${params.toString()}`);
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
  }, [apiKey, dataSourceId, canvasViewDbId]);

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

  // Auto-load the "welcome tour" view when in demo mode (after views are fetched)
  // This needs to be a ref-based approach to avoid stale closures
  const demoModeInitRef = useRef(false);

  useEffect(() => {
    // In demo mode, wait for savedViews to load, then find and load the welcome tour view
    if (isDemoMode && savedViews.length > 0 && items.length > 0 && !demoModeInitRef.current && !loading) {
      // Look for a view that matches "welcome" - case insensitive
      const welcomeView = savedViews.find(v =>
        v.name.toLowerCase().includes('welcome') ||
        v.name.toLowerCase().includes('tour') ||
        v.name.toLowerCase().includes('tutorial')
      );

      if (welcomeView && welcomeView.id) {
        console.log('[CanvasView] Demo mode: Found welcome view:', welcomeView.name);
        demoModeInitRef.current = true;
        setHasLoadedInitialView(true);

        // Load the welcome view from Notion
        (async () => {
          try {
            console.log(`[CanvasView] Demo mode: Loading view "${welcomeView.name}" from Notion...`);
            const response = await fetch(`/api/canvas-views?apiKey=${encodeURIComponent(apiKey)}&viewId=${encodeURIComponent(welcomeView.id!)}`);
            const result = await response.json();

            if (result.success && result.view && result.view.items.length > 0) {
              const viewData = result.view;
              console.log(`[CanvasView] Demo mode: Loaded ${viewData.items.length} items from welcome view`);

              // Build nodes from the view items
              const newNodes: AppNode[] = viewData.items.map((notionItem: any, index: number) => {
                const titleProp = schema.find((s: any) => s.type === 'title')?.name ||
                                  Object.keys(notionItem.properties).find((key: string) =>
                                    key.toLowerCase().includes('title') || key.toLowerCase().includes('name') || key.toLowerCase().includes('plan')
                                  );
                const title = notionItem.properties[titleProp || Object.keys(notionItem.properties)[0]] || notionItem.title || 'Untitled';

                const subItemIds = Array.isArray(notionItem.properties['Sub-item']) ? notionItem.properties['Sub-item'] : [];
                const hasChildren = subItemIds.length > 0;

                // Use saved canvas position from view data
                const savedX = notionItem.canvas_x ?? notionItem.properties?.canvas_x;
                const savedY = notionItem.canvas_y ?? notionItem.properties?.canvas_y;
                const isValidPosition = (
                  savedX !== null && savedX !== undefined &&
                  savedY !== null && savedY !== undefined &&
                  !isNaN(parseFloat(String(savedX))) && !isNaN(parseFloat(String(savedY)))
                );

                const position = isValidPosition
                  ? { x: parseFloat(String(savedX)), y: parseFloat(String(savedY)) }
                  : { x: 100 + (index % 4) * 300, y: 100 + Math.floor(index / 4) * 250 };

                const gradientStart = notionItem.canvas_gradient_start ?? notionItem.properties?.canvas_gradient_start;
                const gradientEnd = notionItem.canvas_gradient_end ?? notionItem.properties?.canvas_gradient_end;
                const gradientColors = (gradientStart && gradientEnd)
                  ? { start: gradientStart, end: gradientEnd }
                  : { start: '#ffffff', end: '#ededed' };

                const nodeHeight = Math.max(180, 100 + subItemIds.length * 45);

                // Check if item has Canvas_Visual image - auto-show image if it exists
                const canvasVisual = notionItem.properties?.['Canvas_Visual'];
                const hasVisualImage = !!(Array.isArray(canvasVisual) && canvasVisual.length > 0 && canvasVisual[0]?.url);

                return {
                  id: notionItem.id,
                  type: 'notionNode',
                  position,
                  style: { width: 250, height: nodeHeight },
                  data: {
                    label: title,
                    properties: notionItem.properties,
                    color: notionItem.canvas_color ?? notionItem.properties?.canvas_color ?? '#ffffff',
                    gradientColors,
                    visibleProperties: [],
                    hasChildren,
                    childrenVisible: !hasVisualImage, // Hide children if showing image
                    showImage: hasVisualImage, // Auto-show image if available
                    titleProp,
                    allItems: items,
                    _needsCallbackPatch: true,
                  },
                } as AppNode;
              });

              setNodes(newNodes);
              console.log('[CanvasView] Demo mode: Finished loading welcome view with', newNodes.length, 'items');

              // Restore viewport if available from the view
              if (viewData.viewport) {
                setHasRestoredViewport(true);
                // Wait a bit for nodes to render before setting viewport
                setTimeout(() => {
                  console.log('[CanvasView] Demo mode: Restoring viewport:', viewData.viewport);
                  reactFlowInstance.setViewport(viewData.viewport);
                }, 150);
              }
            } else {
              console.warn('[CanvasView] Demo mode: Welcome view is empty or failed to load');
            }
          } catch (error) {
            console.error('[CanvasView] Demo mode: Failed to load welcome view:', error);
          }
        })();
      } else {
        console.log('[CanvasView] Demo mode: No welcome view found, canvas will be empty');
        demoModeInitRef.current = true;
        setHasLoadedInitialView(true);
      }
    }
  }, [isDemoMode, savedViews, items, schema, loading, setNodes, apiKey, reactFlowInstance]);

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

      // Check if item has Canvas_Visual image - auto-show image if it exists
      const canvasVisual = item.properties['Canvas_Visual'];
      const hasVisualImage = !!(Array.isArray(canvasVisual) && canvasVisual.length > 0 && canvasVisual[0]?.url);

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
          childrenVisible: hasVisualImage ? false : childrenVisible, // Hide children if showing image
          showImage: hasVisualImage, // Auto-show image if available
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

  // Reorder sub-items using parent's Sub-item array order
  const reorderSubItem = useCallback(async (parentId: string, subItemId: string, direction: 'up' | 'down') => {
    console.log('[CanvasView] Reordering sub-item:', subItemId, 'direction:', direction);

    // Use setNodes with functional form to get current state
    setNodes((currentNodes) => {
      const parentNode = currentNodes.find((n) => n.id === parentId);
      if (!parentNode) {
        console.error('[CanvasView] Parent node not found:', parentId);
        return currentNodes;
      }

      // Get current Sub-item array from node data
      const currentSubItemIds = Array.isArray(parentNode.data.properties['Sub-item'])
        ? [...parentNode.data.properties['Sub-item']]
        : [];

      console.log('[CanvasView] Current Sub-item order:', currentSubItemIds);

      // Find the index of the sub-item being moved
      const currentIndex = currentSubItemIds.indexOf(subItemId);
      if (currentIndex === -1) {
        console.error('[CanvasView] Sub-item not found in parent Sub-item array:', subItemId);
        return currentNodes;
      }

      // Calculate new index
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= currentSubItemIds.length) {
        console.log('[CanvasView] Cannot move further:', direction);
        return currentNodes;
      }

      // Swap positions in the array
      const newSubItemIds = [...currentSubItemIds];
      [newSubItemIds[currentIndex], newSubItemIds[newIndex]] =
        [newSubItemIds[newIndex], newSubItemIds[currentIndex]];

      console.log('[CanvasView] New Sub-item order:', newSubItemIds);

      // Update Notion in background (don't await)
      updateItemProperty(parentId, 'Sub-item', newSubItemIds)
        .then(() => console.log('[CanvasView] Reorder saved to Notion'))
        .catch((err) => console.error('[CanvasView] Failed to save reorder:', err));

      // Update items state
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === parentId
            ? { ...item, properties: { ...item.properties, 'Sub-item': newSubItemIds } }
            : item
        )
      );

      // Return updated nodes
      return currentNodes.map((node) => {
        if (node.id === parentId) {
          return {
            ...node,
            data: {
              ...node.data,
              properties: { ...node.data.properties, 'Sub-item': newSubItemIds },
            },
          };
        }
        return node;
      });
    });
  }, [setNodes, setItems]);

  // Patch callbacks for demo mode nodes (separate effect to avoid stale closures)
  // This effect runs after all callback functions are defined
  useEffect(() => {
    if (!isDemoMode) return;

    setNodes((nds) => {
      const needsPatch = nds.some((n) => n.data._needsCallbackPatch);
      if (!needsPatch) return nds;

      return nds.map((node) => {
        if (!node.data._needsCallbackPatch) return node;

        const item = items.find((i) => i.id === node.id);
        if (!item) return node;

        const titleProp = node.data.titleProp;

        return {
          ...node,
          data: {
            ...node.data,
            _needsCallbackPatch: false,
            onUpdateTitle: (newTitle: string) => {
              updateItemProperty(item.id, titleProp || 'Task Plan', newTitle);
            },
            onUpdateProperty: (propName: string, value: any) => {
              updateItemProperty(item.id, propName, value);
            },
            onUpdateColor: (color: string) => {
              updateItemProperty(item.id, 'canvas_color', color);
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === item.id
                    ? { ...n, data: { ...n.data, color } }
                    : n
                )
              );
            },
            onUpdateGradient: (start: string, end: string) => {
              updateItemProperty(item.id, 'canvas_gradient_start', start);
              updateItemProperty(item.id, 'canvas_gradient_end', end);
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === item.id
                    ? { ...n, data: { ...n.data, gradientColors: { start, end } } }
                    : n
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
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, items, setNodes, toggleSubItems, toggleImage]);

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

  // Handle node deletion - show confirmation dialog instead of immediate delete
  const onNodesDelete = useCallback(
    (nodesToBeDeleted: AppNode[]) => {
      if (nodesToBeDeleted.length === 0) return;

      // Show confirmation dialog
      setNodesToDelete(nodesToBeDeleted);
      setShowDeleteConfirm(true);
    },
    []
  );

  // Delete from canvas only (hide the nodes)
  const handleDeleteFromCanvas = useCallback(() => {
    if (nodesToDelete.length === 0) return;

    // Add to hidden nodes - this removes them from the canvas view
    setHiddenNodes((prev) => {
      const newHidden = new Set(prev);
      nodesToDelete.forEach((node) => newHidden.add(node.id));
      return newHidden;
    });

    // Remove edges connected to deleted nodes
    setEdges((eds) =>
      eds.filter(
        (edge) =>
          !nodesToDelete.some(
            (node) => node.id === edge.source || node.id === edge.target
          )
      )
    );

    // Close dialog
    setShowDeleteConfirm(false);
    setNodesToDelete([]);
  }, [nodesToDelete, setEdges]);

  // Delete from canvas AND Notion database
  const handleDeleteFromNotion = useCallback(async () => {
    if (nodesToDelete.length === 0) return;

    setIsDeleting(true);

    try {
      // Delete (archive) each item in Notion
      for (const node of nodesToDelete) {
        try {
          await fetch('/api/canvas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey,
              dataSourceId,
              action: 'delete',
              itemId: node.id,
            }),
          });
          console.log(`[CanvasView] Deleted item ${node.id} from Notion`);
        } catch (error) {
          console.error(`Failed to delete item ${node.id}:`, error);
        }
      }

      // Remove from nodes
      setNodes((nds) => nds.filter((n) => !nodesToDelete.some((del) => del.id === n.id)));

      // Remove from items
      setItems((itms) => itms.filter((i) => !nodesToDelete.some((del) => del.id === i.id)));

      // Remove connected edges
      setEdges((eds) =>
        eds.filter(
          (edge) =>
            !nodesToDelete.some(
              (node) => node.id === edge.source || node.id === edge.target
            )
        )
      );
    } catch (error) {
      console.error('Failed to delete from Notion:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setNodesToDelete([]);
    }
  }, [nodesToDelete, apiKey, dataSourceId, setNodes, setEdges]);

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

  // Handle setup guide dismissal and continue saving
  const handleSetupGuideClose = () => {
    setShowSetupGuide(false);
    setHasSeenSetupGuide(true);
    localStorage.setItem('hasSeenCanvasViewSetupGuide', 'true');
  };

  const handleContinueSaveAnyway = () => {
    handleSetupGuideClose();
    if (pendingSaveAction) {
      setPendingSaveAction(false);
      // Continue with save action
      performSaveView();
    }
  };

  // Helper function to create Canvas View database if it doesn't exist
  const ensureCanvasViewDatabase = async (): Promise<string | null> => {
    // If we already have a canvas view DB, return it
    if (canvasViewDbId) {
      return canvasViewDbId;
    }

    // If we don't have the task calendar DB ID, can't create Canvas View DB
    if (!taskCalendarDbId) {
      console.warn('[CanvasView] No taskCalendarDbId available to create Canvas View database');
      return null;
    }

    setIsCreatingCanvasViewDb(true);
    console.log('[CanvasView] Creating Canvas View database...');

    try {
      // Call the setup API to create the Canvas View database
      const response = await fetch('/api/databases/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          databaseId: taskCalendarDbId,
          dataSourceId,
          autoSetup: true,
        }),
      });

      const result = await response.json();

      if (result.success && result.canvasViewDbId) {
        console.log('[CanvasView] Created Canvas View database:', result.canvasViewDbId);

        // Update local state
        setCanvasViewDbId(result.canvasViewDbId);

        // Update localStorage config with the new canvasViewDbId
        const configStr = localStorage.getItem('notion_visualizer_config');
        if (configStr) {
          try {
            const config = JSON.parse(configStr);
            config.databases.canvasViewDbId = result.canvasViewDbId;
            localStorage.setItem('notion_visualizer_config', JSON.stringify(config));
            console.log('[CanvasView] Updated config with new canvasViewDbId');
          } catch (e) {
            console.error('[CanvasView] Failed to update config:', e);
          }
        }

        return result.canvasViewDbId;
      } else {
        console.warn('[CanvasView] Failed to create Canvas View database:', result.error);
        return null;
      }
    } catch (error) {
      console.error('[CanvasView] Error creating Canvas View database:', error);
      return null;
    } finally {
      setIsCreatingCanvasViewDb(false);
    }
  };

  // The actual save logic (called after setup guide is dismissed or skipped)
  const performSaveView = async () => {
    const viewName = prompt('Enter a name for this view:');
    if (!viewName) return;

    const currentItemIds = nodes.map(n => n.id);

    // Capture current viewport (zoom and pan position)
    const currentViewport = reactFlowInstance.getViewport();
    const viewport = {
      x: Math.round(currentViewport.x * 100) / 100,
      y: Math.round(currentViewport.y * 100) / 100,
      zoom: Math.round(currentViewport.zoom * 100) / 100,
    };
    console.log('[CanvasView] Saving viewport:', viewport);

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
      // Ensure we have a Canvas View database (create if needed)
      const effectiveCanvasViewDbId = await ensureCanvasViewDatabase();

      if (!effectiveCanvasViewDbId) {
        // Fall back to localStorage only - include positions for local restore
        console.log('[CanvasView] No Canvas View database available, saving locally with positions');
        const localItemPositions = nodes.map(node => ({
          id: node.id,
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
          color: node.data.color,
          gradientStart: node.data.gradientColors?.start,
          gradientEnd: node.data.gradientColors?.end,
        }));
        const newView: SavedView = { name: viewName, itemIds: currentItemIds, viewport, itemPositions: localItemPositions };
        const updatedViews = existingView
          ? savedViews.map(v => v.name === viewName ? newView : v)
          : [...savedViews, newView];

        setSavedViews(updatedViews);
        setViewsSource('local');
        localStorage.setItem(`canvas_views_${dataSourceId}`, JSON.stringify(updatedViews));
        alert(`View "${viewName}" saved locally with positions. Notion sync is not available.`);
        return;
      }

      // Save to Notion (including positions and viewport)
      const response = await fetch('/api/canvas-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          canvasViewDb: effectiveCanvasViewDbId, // Pass the Canvas View DB ID
          name: viewName,
          itemIds: currentItemIds,
          existingViewId: existingView?.id,
          itemPositions,
          viewport,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('[CanvasView] Saved view to Notion:', viewName, 'with', itemPositions.length, 'item positions and viewport:', viewport);

        // Update local state with Notion view ID and viewport
        const newView: SavedView = { id: result.viewId, name: viewName, itemIds: currentItemIds, viewport };

        let updatedViews;
        if (existingView) {
          updatedViews = savedViews.map(v => v.name === viewName ? newView : v);
        } else {
          updatedViews = [...savedViews, newView];
        }

        setSavedViews(updatedViews);
        setViewsSource('notion');
        localStorage.setItem(`canvas_views_${dataSourceId}`, JSON.stringify(updatedViews));

        alert(`View "${viewName}" saved with ${currentItemIds.length} items, positions, and zoom level (${Math.round(viewport.zoom * 100)}%)!`);
      } else {
        throw new Error(result.error || 'Failed to save to Notion');
      }
    } catch (error: any) {
      console.warn('[CanvasView] Failed to save to Notion, saving to localStorage only:', error);

      // Fallback: save to localStorage only - include positions for local restore
      const localItemPositions = nodes.map(node => ({
        id: node.id,
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
        color: node.data.color,
        gradientStart: node.data.gradientColors?.start,
        gradientEnd: node.data.gradientColors?.end,
      }));
      const newView: SavedView = { name: viewName, itemIds: currentItemIds, viewport, itemPositions: localItemPositions };
      const updatedViews = existingView
        ? savedViews.map(v => v.name === viewName ? newView : v)
        : [...savedViews, newView];

      setSavedViews(updatedViews);
      setViewsSource('local');
      localStorage.setItem(`canvas_views_${dataSourceId}`, JSON.stringify(updatedViews));

      alert(`View "${viewName}" saved locally with positions (Notion sync failed: ${error.message})`);
    }
  };

  // Save current view - show guide first for non-demo users who haven't seen it
  const saveCurrentView = async () => {
    // Show setup guide for non-demo users who haven't seen it yet
    if (!isDemoMode && !hasSeenSetupGuide) {
      setPendingSaveAction(true);
      setShowSetupGuide(true);
      return;
    }

    // Otherwise proceed with save
    performSaveView();
  };

  // Load a saved view
  const loadView = async (view: SavedView) => {
    // Clear current canvas
    setNodes([]);
    setEdges([]);
    setShowLoadView(false);

    // Track if we should restore viewport from this view
    let viewportToRestore: { x: number; y: number; zoom: number } | null = null;

    // If view has a Notion ID, fetch full item data with positions from Notion
    if (view.id) {
      try {
        console.log(`[CanvasView] Fetching view "${view.name}" from Notion with positions...`);

        // Build URL with canvasViewDb if available
        const params = new URLSearchParams({
          apiKey,
          viewId: view.id,
        });
        if (canvasViewDbId) {
          params.append('canvasViewDb', canvasViewDbId);
        }
        const response = await fetch(`/api/canvas-views?${params.toString()}`);
        const result = await response.json();

        if (result.success && result.view) {
          const viewData = result.view;
          console.log(`[CanvasView] Fetched ${viewData.items.length} items with positions, viewport:`, viewData.viewport);

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

          // Check for viewport from Notion response
          if (viewData.viewport) {
            viewportToRestore = viewData.viewport;
          }

          console.log(`[CanvasView] Loaded view "${view.name}" with ${viewData.items.length} items from Notion`);

          // Restore viewport after a short delay to ensure nodes are rendered
          if (viewportToRestore) {
            setHasRestoredViewport(true);
            setTimeout(() => {
              console.log('[CanvasView] Restoring viewport:', viewportToRestore);
              reactFlowInstance.setViewport(viewportToRestore!);
            }, 100);
          }

          return;
        } else {
          console.warn('[CanvasView] Failed to fetch from Notion, falling back to local items:', result.error);
        }
      } catch (error) {
        console.warn('[CanvasView] Error fetching from Notion, falling back to local items:', error);
      }
    }

    // Fallback: Add items from local state with saved positions
    console.log(`[CanvasView] Loading view "${view.name}" from local storage with ${view.itemPositions?.length || 0} saved positions`);

    // Build a map of saved positions for quick lookup
    const positionMap = new Map<string, { x: number; y: number; color?: string; gradientStart?: string; gradientEnd?: string }>();
    if (view.itemPositions) {
      view.itemPositions.forEach(pos => {
        positionMap.set(pos.id, pos);
      });
    }

    view.itemIds.forEach((itemId, index) => {
      const item = items.find(i => i.id === itemId);
      if (item) {
        // Check if we have saved local position
        const savedPos = positionMap.get(itemId);
        if (savedPos) {
          // Inject position into item properties for addItemToCanvas to use
          const itemWithPosition = {
            ...item,
            properties: {
              ...item.properties,
              canvas_x: savedPos.x,
              canvas_y: savedPos.y,
              canvas_color: savedPos.color || item.properties.canvas_color,
              canvas_gradient_start: savedPos.gradientStart || item.properties.canvas_gradient_start,
              canvas_gradient_end: savedPos.gradientEnd || item.properties.canvas_gradient_end,
            }
          };
          addItemToCanvas(itemWithPosition);
        } else {
          addItemToCanvas(item);
        }
      }
    });

    // Check for viewport in local view data
    if (view.viewport) {
      viewportToRestore = view.viewport;
      setHasRestoredViewport(true);
      // Restore viewport after a short delay to ensure nodes are rendered
      setTimeout(() => {
        console.log('[CanvasView] Restoring viewport from local view:', viewportToRestore);
        reactFlowInstance.setViewport(viewportToRestore!);
      }, 100);
    }

    console.log(`[CanvasView] Loaded view "${view.name}" with ${view.itemIds.length} items and ${positionMap.size} positions (local fallback)`);
  };

  // Delete a saved view - delete from Notion first, then localStorage
  const deleteView = async (viewName: string) => {
    if (!confirm(`Delete view "${viewName}"?`)) return;

    const viewToDelete = savedViews.find(v => v.name === viewName);
    const updatedViews = savedViews.filter(v => v.name !== viewName);

    // If view has a Notion ID, delete from Notion first
    if (viewToDelete?.id) {
      try {
        const params = new URLSearchParams({
          apiKey,
          viewId: viewToDelete.id,
        });
        if (canvasViewDbId) {
          params.append('canvasViewDb', canvasViewDbId);
        }
        const response = await fetch(`/api/canvas-views?${params.toString()}`, {
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

  const [toolbarExpanded, setToolbarExpanded] = useState(false);

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
      {/* Collapsible Side Panel Toolbar */}
      <div
        className={`absolute top-20 left-0 z-10 transition-all duration-300 ease-in-out ${
          toolbarExpanded ? 'w-64' : 'w-12'
        }`}
      >
        {/* Panel Container */}
        <div className="bg-white/85 backdrop-blur-xl rounded-r-xl shadow-2xl border border-l-0 border-white/40 overflow-hidden">
          {/* Toggle Button */}
          <button
            onClick={() => setToolbarExpanded(!toolbarExpanded)}
            className="w-full p-3 flex items-center justify-center hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors border-b border-gray-200 dark:border-gray-700"
            title={toolbarExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
          >
            <span className={`transform transition-transform duration-300 ${toolbarExpanded ? 'rotate-180' : ''}`}>
              ▶
            </span>
            {toolbarExpanded && <span className="ml-2 font-semibold text-sm">Tools</span>}
          </button>

          {/* Tool Buttons */}
          <div className="p-2 space-y-1">
            {/* Add Item */}
            <button
              onClick={() => { setShowSearch(!showSearch); setToolbarExpanded(true); }}
              className={`w-full flex items-center p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors ${
                showSearch ? 'bg-purple-100 dark:bg-purple-900/40' : ''
              }`}
              title="Add Item"
            >
              <span className="text-lg">🔍</span>
              {toolbarExpanded && <span className="ml-3 text-sm font-medium">Add Item</span>}
            </button>

            {/* Save View */}
            <button
              onClick={saveCurrentView}
              className="w-full flex items-center p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              title="Save View"
            >
              <span className="text-lg">💾</span>
              {toolbarExpanded && <span className="ml-3 text-sm font-medium">Save View</span>}
            </button>

            {/* Load View */}
            <button
              onClick={() => { setShowLoadView(!showLoadView); setToolbarExpanded(true); }}
              className={`w-full flex items-center p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors ${
                showLoadView ? 'bg-purple-100 dark:bg-purple-900/40' : ''
              }`}
              title={`Load View (${savedViews.length})`}
            >
              <span className="text-lg">📂</span>
              {toolbarExpanded && <span className="ml-3 text-sm font-medium">Load View ({savedViews.length})</span>}
            </button>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

            {/* Canvas Background */}
            <div className="p-2">
              <div className="flex items-center mb-2">
                <span className="text-lg">🎨</span>
                {toolbarExpanded && <span className="ml-3 text-sm font-medium">Canvas BG</span>}
              </div>
              {toolbarExpanded && (
                <div className="flex gap-2 mt-2">
                  <div className="flex-1">
                    <input
                      type="color"
                      value={canvasBgGradientStart}
                      onChange={(e) => {
                        setCanvasBgGradientStart(e.target.value);
                        localStorage.setItem('canvas_bg_gradient_start', e.target.value);
                      }}
                      className="w-full h-8 rounded cursor-pointer border border-gray-300"
                      title="Gradient Start"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="color"
                      value={canvasBgGradientEnd}
                      onChange={(e) => {
                        setCanvasBgGradientEnd(e.target.value);
                        localStorage.setItem('canvas_bg_gradient_end', e.target.value);
                      }}
                      className="w-full h-8 rounded cursor-pointer border border-gray-300"
                      title="Gradient End"
                    />
                  </div>
                </div>
              )}
              {!toolbarExpanded && (
                <div className="flex flex-col gap-1 mt-1">
                  <input
                    type="color"
                    value={canvasBgGradientStart}
                    onChange={(e) => {
                      setCanvasBgGradientStart(e.target.value);
                      localStorage.setItem('canvas_bg_gradient_start', e.target.value);
                    }}
                    className="w-8 h-6 rounded cursor-pointer border border-gray-300"
                    title="Gradient Start"
                  />
                  <input
                    type="color"
                    value={canvasBgGradientEnd}
                    onChange={(e) => {
                      setCanvasBgGradientEnd(e.target.value);
                      localStorage.setItem('canvas_bg_gradient_end', e.target.value);
                    }}
                    className="w-8 h-6 rounded cursor-pointer border border-gray-300"
                    title="Gradient End"
                  />
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

            {/* Settings - Database Connection */}
            {onShowSettings && (
              <button
                onClick={onShowSettings}
                className="w-full flex items-center p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                title="Database Settings"
              >
                <span className="text-lg">⚙️</span>
                {toolbarExpanded && <span className="ml-3 text-sm font-medium">Settings</span>}
              </button>
            )}
          </div>
        </div>

        {/* Search Dropdown - appears next to panel when expanded */}
        {showSearch && toolbarExpanded && (
          <div className="absolute left-full top-12 ml-2 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl p-4 w-80 border border-white/40">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search or create new..."
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 mb-2"
              autoFocus
            />

            <div className="max-h-60 overflow-y-auto space-y-1">
              {searchTerm && (
                <button
                  onClick={createNewItem}
                  className="w-full px-3 py-2 text-left hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors font-semibold text-purple-600 dark:text-purple-400 border-b border-purple-200 dark:border-purple-800 mb-1"
                >
                  ✨ Create "{searchTerm}"
                </button>
              )}

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

        {/* Load View Dropdown */}
        {showLoadView && toolbarExpanded && (
          <div className="absolute left-full top-24 ml-2 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl p-4 w-80 border border-white/40">
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
        onNodesDelete={onNodesDelete}
        nodeTypes={nodeTypes}
        fitView={!hasRestoredViewport}
        deleteKeyCode={['Delete', 'Backspace']}
        style={{
          background: `linear-gradient(to bottom right, ${canvasBgGradientStart}, ${canvasBgGradientEnd})`,
        }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* Canvas View Setup Guide Modal */}
      <CanvasViewSetupGuide
        isOpen={showSetupGuide}
        onClose={handleSetupGuideClose}
        onContinueAnyway={handleContinueSaveAnyway}
        mainDatabaseName="your task database"
      />

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
            apiKey={apiKey}
            onUpdateProperty={(propName: string, value: any) => {
              updateItemProperty(editingItemId, propName, value);
            }}
          />
        ) : null;
      })()}

      {/* Delete Confirmation Modal - Light & Modern */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-200/50 p-8 max-w-sm w-full mx-4">
            {/* Icon */}
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center border border-red-100">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">
                Remove {nodesToDelete.length === 1 ? 'Item' : `${nodesToDelete.length} Items`}?
              </h3>
              <p className="text-gray-500 text-sm">
                {nodesToDelete.length === 1
                  ? `"${nodesToDelete[0]?.data?.label || 'Untitled'}"`
                  : `${nodesToDelete.length} selected items`
                }
              </p>
            </div>

            <div className="space-y-2.5">
              {/* Remove from canvas only */}
              <button
                onClick={handleDeleteFromCanvas}
                disabled={isDeleting}
                className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-medium transition-all flex items-center justify-center gap-2 border border-gray-200/80"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
                Hide from Canvas
              </button>

              {/* Delete from Notion */}
              <button
                onClick={handleDeleteFromNotion}
                disabled={isDeleting}
                className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete from Notion
                  </>
                )}
              </button>

              {/* Cancel */}
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setNodesToDelete([]);
                }}
                disabled={isDeleting}
                className="w-full py-2.5 text-gray-500 hover:text-gray-700 font-medium transition-colors disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
              Hide keeps items in Notion • Delete archives them
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrapper component that provides ReactFlowProvider context
// This is required for useReactFlow() hook to work inside CanvasViewInner
export default function CanvasView(props: CanvasViewProps) {
  return (
    <ReactFlowProvider>
      <CanvasViewInner {...props} />
    </ReactFlowProvider>
  );
}
