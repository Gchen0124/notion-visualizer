# Daily Ritual Notion - Code Review & Architecture

**Last Updated:** 2025-12-06
**Latest Commit:** 543d8ca - Make toolbar more compact for cleaner canvas space

## 🏗️ Project Overview

A Next.js app that provides a visual canvas interface for Notion database items. Users can add items to a canvas, arrange them spatially, create hierarchical relationships (parent-child/sub-items), and save/load different canvas views.

**Tech Stack:**
- Next.js 14+ (App Router)
- React 18+
- TypeScript
- ReactFlow (@xyflow/react) - Canvas/node management
- Notion API (@notionhq/client)
- Tailwind CSS

---

## 📁 File Structure

```
app/
├── api/
│   └── canvas/
│       └── route.ts          # API routes for Notion operations
├── canvas/
│   └── page.tsx              # Main canvas page (entry point)
components/
└── canvas/
    ├── CanvasView.tsx        # Main canvas component (state mgmt, business logic)
    ├── NotionNode.tsx        # Individual canvas block/node component
    └── PropertyEditorModal.tsx # Modal for editing all item properties
```

---

## 🔑 Key Concepts & Data Model

### Notion Database Schema

**Core Properties:**
- `Task Plan` (title) - The main item title/name
- `Sub-item` (relation) - Array of child item IDs
- `Parent item` (relation) - Array of parent item IDs (typically 1)

**Canvas-Specific Properties (added during this project):**
- `canvas_x` (rich_text) - X position on canvas
- `canvas_y` (rich_text) - Y position on canvas
- `canvas_color` (rich_text) - Legacy single color (not used anymore)
- `canvas_gradient_start` (rich_text) - Gradient start color
- `canvas_gradient_end` (rich_text) - Gradient end color
- `canvas_view` (rich_text) - View name this item belongs to
- `canvas_width` (rich_text) - Not currently used

**Database ID:** `1eed6707-fb13-80e7-b06e-000b4e2ed93c`

### Data Flow

```
User Action
    ↓
CanvasView.tsx (state update)
    ↓
API Route (/api/canvas)
    ↓
Notion API
    ↓
Database Update
    ↓
State Sync (optimistic + actual)
```

---

## 🧩 Component Architecture

### 1. **CanvasView.tsx** (Main Component)

**Purpose:** Orchestrates the entire canvas experience

**State Management:**
```typescript
const [nodes, setNodes, onNodesChange] = useNodesState([]);  // ReactFlow nodes
const [edges, setEdges, onEdgesChange] = useEdgesState([]);  // ReactFlow edges
const [items, setItems] = useState<any[]>([]);               // Notion items
const [schema, setSchema] = useState<any[]>([]);             // DB schema
const [savedViews, setSavedViews] = useState<...>([]);       // Saved canvas views
```

**Key Functions:**

1. **`addItemToCanvas(item)`** (lines 147-277)
   - Converts Notion item to ReactFlow node
   - Reads Sub-item property to determine if it has children
   - Sets `childrenVisible = true` by default
   - Validates positions (rejects extreme negatives)
   - Uses grid layout if no saved position
   - Height calculated based on sub-item count: `150 + (subItems.length * 45)`

2. **`createSubItem(parentId, title)`** (lines 395-489)
   - **CRITICAL:** Uses functional form of `setItems` to avoid race conditions
   - Creates new item in Notion with `Parent item` relation
   - Updates parent's `Sub-item` array
   - Immediately updates both `items` state AND node data
   - This prevents sub-items from disappearing when adding multiple quickly

3. **`deleteSubItem(subItemId, parentId)`** (lines 491-561)
   - Archives the sub-item in Notion
   - Updates parent's `Sub-item` array
   - Removes from local state

4. **`saveCurrentView()`** (lines 726-743)
   - Prompts for view name
   - Saves to localStorage: `canvas_views_{dataSourceId}`
   - **Also saves view name to each item's `canvas_view` property in Notion**
   - Format: `{name: string, itemIds: string[]}`

5. **`loadView(view)`** (lines 745-756)
   - Clears current canvas
   - Calls `addItemToCanvas` for each item ID in the view
   - Items restore from their saved canvas_x/canvas_y positions

**Position Saving:**
```typescript
// On drag end (lines 927-935)
onNodesChange={(changes) => {
  if (change.type === 'position' && !change.dragging) {
    updateItemProperty(id, 'canvas_x', Math.round(x));
    updateItemProperty(id, 'canvas_y', Math.round(y));
  }
}}
```

**Important Nuances:**
- Position validation: Only accepts positions in range -500 to 3000
- Grid layout: 4 items per row, spacing 300x250
- All property updates go through `updateItemProperty()` which hits the API
- Schema is fetched once and used for type validation throughout

---

### 2. **NotionNode.tsx** (Individual Block Component)

**Purpose:** Renders a single item block on the canvas

**Display Modes:**
1. **Compact Mode** (`childrenVisible = false`)
   - Centered large title (text-2xl)
   - Icons at bottom (color, settings, show sub-items)
   - Fixed height, centered content

2. **Expanded Mode** (`childrenVisible = true`)
   - Smaller title (text-sm) with icons at top
   - Sub-items list visible with controls
   - Dynamic height based on sub-item count

**Sub-items Display** (lines 79-91):
```typescript
// Reads directly from properties (like PropertyEditorModal does)
const subItemIds = Array.isArray(data.properties['Sub-item'])
  ? data.properties['Sub-item']
  : [];

const subItems = subItemIds.map((id: string) => {
  const item = data.allItems.find((i) => i.id === id);
  return {
    id,
    title: item?.properties[data.titleProp] || 'Untitled',
    color: item?.properties.canvas_gradient_start || '#6b7280',
  };
});
```

**Color Picker** (lines 200-267):
- Shows gradient start/end pickers
- 6 preset gradients
- **Click-outside-to-close:** Uses refs + setTimeout pattern
- `colorPickerRef` and `colorButtonRef` track elements
- Event listener added with 0ms delay to avoid immediate close

**Critical Details:**
- Must receive `allItems` and `titleProp` in data for sub-items to work
- Uses `NodeResizer` for manual block resizing
- White text for sub-items against gray backgrounds
- Border color derived from gradient start color

---

### 3. **PropertyEditorModal.tsx** (Property Editor)

**Purpose:** Edit all properties of an item in a modal

**Key Features:**
- Renders input based on property type from schema
- Supports: title, rich_text, number, checkbox, select, multi_select, date, url, email, phone, relation
- For relations: Shows selected items as chips with remove buttons
- Dropdown to add more relations
- Read-only for: people, files, formula, rollup, created_time, etc.

**Important Pattern:**
```typescript
const [editedProperties, setEditedProperties] = useState<...>({});

// On mount, copy all properties
useEffect(() => {
  setEditedProperties({ ...properties });
}, [properties, itemId]);

// On save, only update changed properties
Object.entries(editedProperties).forEach(([propName, value]) => {
  if (value !== properties[propName]) {
    onUpdateProperty(propName, value);
  }
});
```

---

### 4. **API Route** (`app/api/canvas/route.ts`)

**GET Endpoint** (lines 5-76):
- Fetches all pages from data source using pagination
- Extracts schema from first page
- Transforms properties using `extractPropertyValue()`
- Returns `{items, schema}`

**POST Endpoint** (lines 79-150):
- Handles 3 actions: create, update, delete
- Uses `formatPropertiesForNotion()` to convert simple values to Notion format

**Property Formatting** (lines 188-263):
```typescript
// Key insight: Must match schema types exactly
if (propType === 'title') {
  formatted[name] = { title: [{ text: { content: String(value) } }] };
} else if (propType === 'relation') {
  formatted[name] = { relation: Array.isArray(value) ? value.map(id => ({id})) : [] };
}
// ... etc
```

**Special Cases:**
- `Parent item` and `Parent` are allowed even if not in schema (lines 199-206)
- Properties not in schema are skipped to avoid errors
- Auto-detects title properties if schema unavailable

**CRITICAL:** Notion API requires specific formats:
- Title: `{title: [{text: {content: "..."}}]}`
- Relation: `{relation: [{id: "..."}, ...]}`
- Rich text: `{rich_text: [{text: {content: "..."}}]}`
- etc.

---

## ⚠️ Known Issues & Gotchas

### 1. **Race Conditions in Sub-item Creation**
**Problem:** Adding multiple sub-items quickly would lose intermediate ones.
**Solution:** Use functional form of `setItems((currentItems) => ...)` to always read latest state.
**Fixed in:** Commit 8ebf201

### 2. **Position Validation**
**Problem:** Items were being positioned way off-screen with extreme negative coordinates.
**Solution:** Validate positions and reject if outside -500 to 3000 range.
**Fixed in:** Commit 14dad0f

### 3. **Property Name Confusion**
**Problem:** Code used `"Parent"` but database has `"Parent item"`.
**Solution:** Search for actual property names, use correct ones.
**Fixed in:** Commit a45ebbb

### 4. **Color Picker Not Closing**
**Problem:** When sub-items hidden, clicking color button wouldn't close picker.
**Solution:** Use refs and setTimeout to add click-outside listener after current click.
**Fixed in:** Commit 09e6b29

### 5. **Stale State in Node Updates**
**Issue:** After creating sub-item, parent node wouldn't show it immediately.
**Solution:** Immediately call `setNodes()` with updated properties and allItems after state changes.

---

## 🎨 Styling Patterns

**Glassmorphism Theme:**
```css
bg-white/80 dark:bg-black/40 backdrop-blur-md
```

**Gradient Backgrounds:**
```typescript
background: `linear-gradient(135deg, ${start}, ${end})`
```

**Conditional Classes:**
```typescript
className={`font-semibold cursor-text ${
  data.childrenVisible ? 'text-sm' : 'text-2xl'
}`}
```

**Default Colors:**
- Canvas: `#fff25c` → `#ffc7fa` (yellow to pink)
- Blocks: `#ffffff` → `#ededed` (white gradient)

---

## 🔄 State Synchronization Strategy

**Optimistic Updates:**
1. Update local state immediately (for instant UI feedback)
2. Call API in background
3. Don't wait for API response
4. Trust that Notion API succeeds (no error rollback currently)

**Example:**
```typescript
// Update local state first
setItems(updatedItems);
setNodes(updatedNodes);

// Then update Notion (fire and forget)
updateItemProperty(id, 'Sub-item', updatedSubItems);
```

**Consideration:** This can lead to drift if API fails. Future improvement: Add error handling and state rollback.

---

## 📊 Data Persistence Layers

**Three Storage Locations:**

1. **React State** (ephemeral)
   - `nodes`, `edges`, `items`, `schema`
   - Lost on page refresh

2. **localStorage** (browser-persisted)
   - Saved views: `canvas_views_{dataSourceId}`
   - Canvas background colors: `canvas_bg_gradient_start/end`

3. **Notion Database** (permanent)
   - All item properties including canvas positions
   - canvas_view, canvas_gradient_start/end
   - Sub-item and Parent item relations

**Loading Flow:**
1. Fetch items from Notion API
2. Load saved views from localStorage
3. User selects a view → restore from item properties in Notion

---

## 🧪 Testing Considerations

**Critical Test Cases:**
1. Add multiple sub-items rapidly (race condition test)
2. Save view → close app → reload → load view (persistence test)
3. Drag items to extreme positions (validation test)
4. Change colors → verify saved to Notion (API integration test)
5. Create item without sub-items (should start in compact mode)
6. Add first sub-item to compact item (should expand)

**Missing:**
- No unit tests
- No error boundaries
- No loading states during API calls
- No retry logic for failed API calls

---

## 🚀 Performance Considerations

**Current Optimizations:**
- `memo()` wrapper on NotionNode to prevent unnecessary re-renders
- Functional state updates to avoid stale closures
- Position validation to avoid off-screen items

**Potential Issues:**
- Large databases (100+ items) may slow down initial load
- No pagination on frontend (loads all items)
- No virtualization for long sub-item lists
- Multiple API calls when saving view (one per item)

**Future Improvements:**
- Debounce position updates (currently saves on every drag end)
- Batch API updates when saving views
- Virtual scrolling for item search dropdown

---

## 🔐 Security Considerations

**API Key Handling:**
- Passed as query parameter (visible in browser console)
- Stored in app state (not localStorage for security)
- User must provide key each session

**Notion API:**
- Uses user's API key (user's permissions apply)
- No server-side API key storage
- Direct client-to-Notion communication through Next.js API route

---

## 📝 Code Quality Observations

**Good Practices:**
✅ TypeScript for type safety
✅ Functional components with hooks
✅ Separation of concerns (API route, components)
✅ Using established libraries (ReactFlow, Notion SDK)
✅ Descriptive variable names
✅ Console logging for debugging

**Areas for Improvement:**
⚠️ Missing error handling (try/catch exists but no user feedback)
⚠️ No loading states (users see nothing while API calls run)
⚠️ Inconsistent naming (canvas_color vs canvas_gradient_start)
⚠️ Magic numbers (150, 45 for height calculations)
⚠️ No validation of user inputs (view names, item titles)
⚠️ Deep nesting in some components
⚠️ Large component files (CanvasView.tsx is 950+ lines)

---

## 🎯 Future Enhancement Ideas

1. **Auto-save** - Save canvas state every 30 seconds
2. **Collaborative editing** - Multiple users on same canvas
3. **Undo/redo** - History stack for canvas operations
4. **Keyboard shortcuts** - Delete, copy, paste, etc.
5. **Export** - Save canvas as image or PDF
6. **Templates** - Pre-configured canvas layouts
7. **Filters** - Show/hide items by property values
8. **Search in canvas** - Highlight matching items
9. **Zoom controls** - Better navigation for large canvases
10. **Item linking** - Custom edges beyond parent-child

---

## 🔍 Important Code Locations

**When debugging sub-items:**
- Creation: `CanvasView.tsx:395-489`
- Display: `NotionNode.tsx:79-91, 294-354`
- Deletion: `CanvasView.tsx:491-561`

**When debugging positions:**
- Save on drag: `CanvasView.tsx:927-935`
- Validation: `CanvasView.tsx:177-191`
- Grid layout: `CanvasView.tsx:184-191`

**When debugging views:**
- Save: `CanvasView.tsx:726-743`
- Load: `CanvasView.tsx:745-756`
- Storage: localStorage key pattern `canvas_views_{dataSourceId}`

**When debugging colors:**
- Gradient update: `CanvasView.tsx:247-257`
- Color picker: `NotionNode.tsx:200-267`
- Click-outside: `NotionNode.tsx:35-61`

---

## 💡 Key Insights for Next Session

1. **Always use functional setState for items/nodes** to avoid race conditions
2. **Sub-item property is `"Sub-item"` not `"subitem"`** - exact casing matters
3. **Parent property is `"Parent item"` not `"Parent"`** - Notion schema specific
4. **Position range: -500 to 3000** - outside this is considered invalid
5. **Height formula: `150 + (subItems.length * 45)`** - for calculating node height
6. **Views are dual-stored:** localStorage (view list) + Notion (item positions)
7. **Color picker uses setTimeout trick** - without it, click-outside fires immediately
8. **Database ID:** `1eed6707-fb13-80e7-b06e-000b4e2ed93c`
9. **Title property:** `"Task Plan"` - this is the main identifier field
10. **allItems must be passed to nodes** - required for sub-item lookup

---

## 🐛 Debugging Tips

**Sub-items not showing:**
- Check console for `[CanvasView]` logs
- Verify `Sub-item` property exists and has IDs
- Verify `allItems` is being passed to node data
- Check `childrenVisible` state

**Position issues:**
- Check console for position validation logs
- Look for extreme negative coordinates
- Verify `canvas_x` and `canvas_y` properties exist

**View not loading:**
- Check localStorage: `localStorage.getItem('canvas_views_{dataSourceId}')`
- Verify item IDs in view still exist in database
- Check console for item lookup failures

**Colors not saving:**
- Verify properties exist: `canvas_gradient_start`, `canvas_gradient_end`
- Check API route logs for "Skipping property" messages
- Ensure schema includes these properties

---

**End of Code Review**

This document should provide complete context for future development sessions.
