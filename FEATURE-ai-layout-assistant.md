# Feature Request: AI-Powered Canvas Layout Assistant

## Overview

An intelligent layout assistant that analyzes users' Notion items and their properties to generate strategic visual arrangements on the canvas. Users can describe how they want items organized, and the AI generates multiple layout previews to choose from.

## Core Value Proposition

- **No presets** - Every layout is dynamically generated based on the user's actual data and properties
- **Property-driven** - Users select which properties matter (deadline, priority, status, effort, impact, etc.)
- **Strategic thinking** - AI suggests layouts that reveal insights (e.g., "Your high-impact/low-effort items should be prioritized")
- **Preview & choose** - Multiple layout options presented before committing

---

## User Experience Flow

### 1. Opening the Layout Assistant
- User clicks a new "AI Layout" button (sparkle/wand icon) in the canvas toolbar
- A chat panel slides in from the right side

### 2. Property Selection
- AI analyzes available properties from the user's items
- Suggests relevant properties for layout criteria
- User can select/deselect properties to consider
- Example: "I see you have Deadline, Priority, Status, and Effort Level. Which should I use for the layout?"

### 3. Layout Request
User types natural language requests like:
- "Arrange items by deadline, with urgent ones larger and red"
- "Group by status, with in-progress items in the center"
- "Create a priority matrix with impact vs effort"
- "Show me a timeline view based on due dates"
- "Cluster related items together based on their tags"

### 4. Preview Generation
- AI generates **3 different layout options**
- Each preview shows:
  - Thumbnail/mini-preview of the layout
  - Brief description of the arrangement logic
  - Which properties were used
- User can browse/swipe through options

### 5. Apply or Iterate
- User selects preferred layout → Applied to canvas
- Or user provides feedback: "I like option 2 but make the spacing wider"
- AI refines and generates new options

---

## Proactive Suggestions

The AI can proactively suggest layouts when:
- User first loads items onto canvas (cold start)
- User adds many new items at once
- Items have clear patterns (all have deadlines, all have priorities)

Example suggestions:
- "I notice your items have deadlines spanning the next 3 months. Want me to arrange them as a timeline?"
- "You have items marked as High/Medium/Low priority. Should I create a priority-based layout?"
- "Some items are blocked. Want to see a dependency view?"

---

## Technical Implementation

### AI Provider
- **Gemini Flash** (free tier: 15 requests/minute, 1500/day)
- Fallback: Queue requests if rate limited

### Data Sent to AI
```json
{
  "items": [
    {
      "id": "abc123",
      "title": "Build login page",
      "properties": {
        "Status": "In Progress",
        "Priority": "High",
        "Deadline": "2025-01-15",
        "Effort": "Medium",
        "Tags": ["frontend", "auth"]
      },
      "current_position": { "x": 100, "y": 200 }
    }
  ],
  "canvas_size": { "width": 1920, "height": 1080 },
  "user_request": "Arrange by priority with high priority items at the top",
  "selected_properties": ["Priority", "Status"]
}
```

### AI Response Format
```json
{
  "layouts": [
    {
      "name": "Priority Cascade",
      "description": "High priority items at top, flowing down by urgency",
      "items": [
        {
          "id": "abc123",
          "x": 500,
          "y": 100,
          "width": 300,
          "height": 200,
          "color": "#ff6b6b",
          "reasoning": "High priority - prominent position and red color"
        }
      ]
    },
    {
      "name": "Priority Columns",
      "description": "Three columns: High, Medium, Low priority",
      "items": [...]
    },
    {
      "name": "Priority Spiral",
      "description": "High priority in center, radiating outward",
      "items": [...]
    }
  ],
  "insights": "You have 5 high-priority items due this week. Consider focusing on these first."
}
```

### API Endpoint
```
POST /api/ai-layout
Body: { items, canvasSize, userRequest, selectedProperties }
Response: { layouts: [...], insights: string }
```

### Cost Estimation
- Gemini Flash free tier: 1500 requests/day
- Average user: ~5-10 layout requests per session
- Can serve ~150-300 active users/day on free tier
- Upgrade path: Gemini Pro ($0.00025/1K chars) if needed

---

## UI Components Needed

### 1. AI Layout Button
- Location: Canvas toolbar (left side panel)
- Icon: Sparkle or magic wand
- Opens the AI assistant panel

### 2. AI Assistant Panel
- Slide-in panel from right (400px width)
- Chat-style interface
- Property selector checkboxes
- Text input for requests

### 3. Layout Preview Carousel
- 3 preview cards side by side (or swipeable on mobile)
- Each card shows:
  - Mini canvas preview (200x150px)
  - Layout name
  - Description
  - "Apply" button

### 4. Proactive Suggestion Toast
- Subtle notification when AI has suggestions
- "AI has layout suggestions based on your items"
- Click to open assistant panel

---

## Database Changes

### Canvas View table - New properties
| Property | Type | Description |
|----------|------|-------------|
| `ai_generated` | Checkbox | Whether this view was AI-generated |
| `layout_criteria` | Rich Text | Properties used for layout |
| `layout_description` | Rich Text | AI's description of the layout |

### No changes needed to Task Calendar items
- Uses existing properties for analysis
- Updates existing `canvas_x`, `canvas_y`, `item_width`, `item_height`, `canvas_color`

---

## Implementation Phases

### Phase 1: Basic AI Layout (MVP)
- [ ] Add Gemini API integration
- [ ] Create `/api/ai-layout` endpoint
- [ ] Build AI assistant panel UI
- [ ] Single layout generation (no preview carousel yet)
- [ ] Apply layout to canvas

### Phase 2: Preview & Choose
- [ ] Generate 3 layout options
- [ ] Preview carousel UI
- [ ] Layout comparison view
- [ ] Apply selected layout

### Phase 3: Proactive Suggestions
- [ ] Analyze items on load
- [ ] Generate automatic suggestions
- [ ] Suggestion toast notifications
- [ ] "Quick apply" for suggestions

### Phase 4: Refinement
- [ ] "Refine this layout" follow-up prompts
- [ ] Save favorite layout patterns
- [ ] Share layouts with others

---

## Example Prompts & Expected Layouts

| User Request | Layout Type | Visual Result |
|--------------|-------------|---------------|
| "Sort by deadline" | Timeline | Left-to-right chronological |
| "Priority matrix" | 2x2 Grid | Quadrants by impact/effort |
| "Group by status" | Clusters | Status-colored groups |
| "Show dependencies" | Flow chart | Connected nodes |
| "Highlight overdue" | Emphasis | Red/large for overdue items |
| "Eisenhower matrix" | 4 Quadrants | Urgent/Important axes |

---

## Success Metrics

- **Adoption**: % of users who try AI layout
- **Satisfaction**: % who apply generated layouts (vs. dismiss)
- **Iteration**: Avg. refinement requests before accepting
- **Retention**: Do users with AI layouts return more often?

---

## Open Questions

1. Should we allow users to "undo" AI layout changes easily?
2. Should AI layouts be auto-saved as new views, or overwrite current?
3. How to handle very large item counts (100+ items)?
4. Should we cache common layout patterns to reduce API calls?

---

## Priority: HIGH

This feature differentiates us from other Notion visualization tools and provides genuine AI value that helps users think strategically about their work.
