# UI Architecture & Design System

> **Document Version:** 1.0  
> **Palette Codename:** `teal-dark`  
> **App:** Agency Management App — Multi-tenant B2B SaaS

---

## 1. Design System & Style Guide

### 1.1 Color Tokens

| Token | HEX / RGBA | CSS Variable | Usage |
|---|---|---|---|
| `--accent-primary` | `#3A959A` | `--accent-primary` | Active accents, borders, keycap text, selection indicators, interactive highlights |
| `--accent-glow` | `#46B3B8` | `--accent-glow` | Hover states, glowing halos, focus rings, cyan shimmer |
| `--accent-muted` | `rgba(58, 149, 154, 0.15)` | `--accent-muted` | Badge tint, subtle background fills, pill backgrounds |
| `--canvas-bg` | `#0B0D12` | `--canvas-bg` | Main app background |
| `--canvas-grid` | `#181B24` | `--canvas-grid` | 24px × 24px dot-grid overlay on canvas |
| `--surface-inset` | `#0D0F14` | `--surface-inset` | Code editor, terminal, input fields, inset panels |
| `--surface-float` | `#161922` | `--surface-float` | Modals, command palette, dropdowns, popovers |
| `--surface-hover` | `#1E2330` | `--surface-hover` | Hovered list items, active sidebar rows, button hover |
| `--border-default` | `#262B38` | `--border-default` | Borders, dividers, card outlines |
| `--text-primary` | `#E2E8F0` | `--text-primary` | High-contrast body text, headings |
| `--text-secondary` | `#94A3B8` | `--text-secondary` | Labels, descriptions, muted body |
| `--text-dim` | `#64748B` | `--text-dim` | Placeholders, disabled text, metadata |
| `--danger` | `#EF4444` | `--danger` | Destructive actions, error states, delete |
| `--success` | `#22C55E` | `--success` | Success states, online indicators |
| `--warning` | `#EAB308` | `--warning` | Warning badges, pending states |

### 1.2 Typography

| Role | Font Family | Weight | Size | Line Height |
|---|---|---|---|---|
| Display / Heading L | `Inter`, system-ui, -apple-system, sans-serif | 700 (Bold) | 24px | 1.3 |
| Heading M | `Inter`, sans-serif | 600 (Semibold) | 18px | 1.4 |
| Heading S | `Inter`, sans-serif | 600 (Semibold) | 14px | 1.4 |
| Body | `Inter`, sans-serif | 400 (Regular) | 13px | 1.5 |
| Body Small / Caption | `Inter`, sans-serif | 400 (Regular) | 12px | 1.4 |
| Mono / Code | `JetBrains Mono`, `Fira Code`, monospace | 400 (Regular) | 13px | 1.5 |
| Keycap | `Inter`, sans-serif | 600 (Semibold) | 11px | 1 |

### 1.3 Keycap Styling

```
┌─────────────────────────────────────────┐
│  Background:  #161922  (--surface-float) │
│  Border:      1px solid #3A959A (glowing)│
│  Text:        #3A959A  (--accent-primary)│
│  Radius:      4px                        │
│  Padding:     2px 6px                    │
│  Font:        11px / 1  Semibold         │
│  Box-shadow:  0 0 6px rgba(58,149,154,0.3)│
└─────────────────────────────────────────┘
```

### 1.4 Status Badges

| Variant | Background | Text Color | Border |
|---|---|---|---|
| **Active / Online** | `rgba(34, 197, 94, 0.15)` | `#22C55E` | `1px solid rgba(34, 197, 94, 0.3)` |
| **Idle / Away** | `rgba(234, 179, 8, 0.15)` | `#EAB308` | `1px solid rgba(234, 179, 8, 0.3)` |
| **Error / Offline** | `rgba(239, 68, 68, 0.15)` | `#EF4444` | `1px solid rgba(239, 68, 68, 0.3)` |
| **Info / Neutral** | `rgba(58, 149, 154, 0.15)` | `#3A959A` | `1px solid rgba(58, 149, 154, 0.3)` |
| **Pending** | `rgba(100, 116, 139, 0.15)` | `#94A3B8` | `1px solid rgba(100, 116, 139, 0.3)` |

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}
```

### 1.5 Border / Glow Micro-interactions

| Element | Default | Hover / Active |
|---|---|---|
| Input / Textarea | `1px solid #262B38` | `1px solid #3A959A` + `box-shadow: 0 0 0 3px rgba(58,149,154,0.1)` |
| Button (primary) | `bg: #3A959A`, `border: 1px solid #3A959A` | `bg: #46B3B8`, `box-shadow: 0 0 12px rgba(58,149,154,0.3)` |
| Card / Panel | `1px solid #262B38` | (n/a) |
| Modal | `1px solid #3A959A` (top accent border) | (n/a) |

### 1.6 Dark Grid Overlay CSS

```css
body, .app-shell {
  background-color: #0B0D12;
  background-image:
    linear-gradient(rgba(24, 27, 36, 0.6) 1px, transparent 1px),
    linear-gradient(90deg, rgba(24, 27, 36, 0.6) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

---

## 2. Application Layout Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  GLOBAL HEADER / TOP NAVBAR         ⌘K  [health]  [avatar]  │  │
│  │  #0B0D12   border-bottom: 1px solid #262B38   height: 48px   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────┬───────────────────────────────────────────────┐  │
│  │              │                                               │  │
│  │  SIDEBAR     │   MAIN CONTENT AREA                          │  │
│  │  (220px)     │                                               │  │
│  │              │   ┌───────────────────────────────────────┐  │  │
│  │  Dashboard   │   │                                       │  │  │
│  │  ─────────── │   │   Page content (route-driven)         │  │  │
│  │  Chat        │   │                                       │  │  │
│  │  Agents      │   │   - Dashboard metrics grid            │  │  │
│  │  Playground  │   │   - Chat message stream               │  │  │
│  │  Settings    │   │   - Agent builder dual-pane            │  │  │
│  │              │   │   - Settings / Role Mgmt               │  │  │
│  │  [Org name]  │   │                                       │  │  │
│  │              │   └───────────────────────────────────────┘  │  │
│  │              │                                               │  │
│  └──────────────┴───────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  TELEMETRY / STATUS BAR   [latency] [version] [realtime]    │  │
│  │  #0D0F14   border-top: 1px solid #262B38   height: 28px     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.1 Layout Dimensions

| Region | Width | Height | Background |
|---|---|---|---|
| Top Navbar | 100% | 48px | `#0B0D12` |
| Sidebar | 220px | `calc(100vh - 48px - 28px)` | `#0D0F14` |
| Main Content | `calc(100% - 220px)` | `calc(100vh - 48px - 28px)` | `#0B0D12` with grid |
| Telemetry Bar | 100% | 28px | `#0D0F14` |

### 2.2 Command Palette Overlay (`⌘K`)

```
┌──────────────────────────────────────────────────────┐
│                    ┌──────────────────┐              │
│                    │  ⌘K  Quick Launch │              │
│                    │  ─────────────── │              │
│                    │  > [search...]   │              │
│                    │                  │              │
│                    │  ┌────────────┐  │              │
│                    │  │ Dashboard  │  │ ← active     │
│                    │  │ Chat       │  │   2px #3A959A│
│                    │  │ Agents     │  │   left border│
│                    │  │ Settings   │  │              │
│                    │  └────────────┘  │              │
│                    │                  │              │
│                    │  Surface:        │              │
│                    │  #161922         │              │
│                    │  Border:         │              │
│                    │  1px #262B38     │              │
│                    └──────────────────┘              │
└──────────────────────────────────────────────────────┘
```

---

## 3. Detailed Page & Component Breakdown

### 3.1 Global Header & Command Palette

**File(s):** `frontend/src/App.tsx` (nav), new `GlobalHeader.tsx`, new `CommandPalette.tsx`

```
┌──────────────────────────────────────────────────────────────┐
│ [logo] Agency Management     [⌘K search]     [●]  [👤]  [≡]  │
│  ^-- + hover: #1E2330       ^-- keycap       ^API  ^user   │
│      brand font               bg: #161922    health menu  │
│      #E2E8F0                  border: #3A959A               │
│                               text: #3A959A                 │
└──────────────────────────────────────────────────────────────┘
```

**Elements:**
- **Brand/Logo:** Left-aligned, `--text-primary`, 14px semibold. Clicking navigates to `/dashboard`.
- **Command Palette Trigger:** Centered. Renders a keycap-style `<kbd>` with text `⌘K`. Clicking opens the overlay.
  - Keycap: `bg: #161922`, `border: 1px solid #3A959A`, `color: #3A959A`, `box-shadow: 0 0 6px rgba(58,149,154,0.3)`.
  - On hover: border brightens to `#46B3B8`, shadow intensifies.
- **API Health Badge:** Small dot indicator. Green (`#22C55E`) when connected, red (`#EF4444`) when degraded.
- **User Avatar / Menu:** Right-aligned. Shows user initials on `#1E2330` circle. Dropdown: Profile, Logout.
- **Connection Status (future):** Supabase Realtime connection status — green pulse when live.

**States:**
- **Default:** All elements visible, idle.
- **Sticky on scroll:** Header remains fixed at top (`position: sticky; top: 0; z-index: 100`).

### 3.2 Dashboard (`/dashboard`)

**File(s):** New `DashboardPage.tsx`, `MetricsCard.tsx`, `SystemTraceTable.tsx`, `AgentQuickTriggers.tsx`  
*Note: Currently the app redirects `/` to `/projects` (`App.tsx:84`). This section defines the forward-looking dashboard.*

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        │
│  │ 128  │ │ 12   │ │ 3.4s │ │ 99.2%│   ← Metrics Cards     │
│  │ Active│ │ Agents│ │ Avg  │ │ Success│  bg: #0D0F14       │
│  │ Runs  │ │Online │ │Resp  │ │ Rate   │  border: #262B38   │
│  └──────┘ └──────┘ └──────┘ └──────┘                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ System Trace Log                    [Filter ▼] [↻]  │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ 12:34:56 │ agent-1 │ RUN_START   │ #3A959A ● active │   │
│  │ 12:34:55 │ agent-3 │ TOOL_CALL   │ #94A3B8 ● running│   │
│  │ 12:34:54 │ agent-2 │ COMPLETED   │ #22C55E ● done   │   │
│  │ ...      │ ...     │ ...         │                   │   │
│  │  bg: #0D0F14  text: #94A3B8  border: #262B38        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│  │ ▶ agent-1│ │ ▶ agent-2│ │ ▶ agent-3│   ← Quick Triggers│
│  │  Run Now  │ │  Run Now  │ │  Run Now  │  bg: #161922     │
│  └──────────┘ └──────────┘ └──────────┘  border: #262B38    │
└──────────────────────────────────────────────────────────────┘
```

**Components & Hierarchy:**

```
DashboardPage
├── MetricsCardRow
│   ├── MetricsCard (Active Runs)       — value: 128, label: "Active Runs"
│   ├── MetricsCard (Agents Online)     — value: 12,  label: "Agents Online"
│   ├── MetricsCard (Avg Response)      — value: 3.4s, label: "Avg Response"
│   └── MetricsCard (Success Rate)      — value: 99.2%, label: "Success Rate"
├── SystemTraceTable
│   └── TraceRow[]                      — timestamp, agentId, eventType, status badge
└── AgentQuickTriggers
    └── TriggerCard[]                   — agent name, "Run Now" button with teal glow on hover
```

**Data Flow:**
- `DashboardPage` fetches aggregated metrics from Supabase/Services on mount.
- Each `MetricsCard` receives `{ value, label, trend? }` props.
- `SystemTraceTable` pulls recent 50 trace entries from a `traces` table or service.
- `AgentQuickTriggers` lists active agents; clicking "Run Now" dispatches a run via `AgentService.runAgent(id)`.

### 3.3 Agent Architect & Builder (`/agents/[id]/builder`)

**File(s):** New `AgentBuilderPage.tsx`, `PromptInspector.tsx`, `VariableTagChips.tsx`, `ToolBindingsPanel.tsx`, `DAGGraph.tsx`

```
┌──────────────────────────────────────────────────────────────┐
│  ┌───────────────────┬──────────────────────────────────┐   │
│  │  PROMPT INSPECTOR │     DAG EXECUTION GRAPH          │   │
│  │  (Monaco Editor)  │                                  │   │
│  │                   │      ┌─────┐                     │   │
│  │  System Prompt:   │      │input│                     │   │
│  │  ┌──────────────┐ │      └──┬──┘                     │   │
│  │  │ You are an   │ │         ▼                        │   │
│  │  │ agent that.. │ │      ┌─────┐  ┌─────┐           │   │
│  │  │              │ │      │ llm │──│ tool│           │   │
│  │  │ {{context}}  │ │      └─────┘  └──┬──┘           │   │
│  │  │ {{tools}}    │ │                   ▼              │   │
│  │  └──────────────┘ │               ┌─────┐            │   │
│  │                   │               │output│           │   │
│  │  Variables:       │               └─────┘            │   │
│  │  [context] [tools]│     bg: #0D0F14                  │   │
│  │  [memory]         │     border: #262B38              │   │
│  │                   │                                  │   │
│  │  bg: #0D0F14      │     Nodes: #161922              │   │
│  │  border: #262B38  │     Active node: #3A959A glow    │   │
│  └───────────────────┴──────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  TOOL BINDINGS                                       │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ ☑ fetch_web  [base_url] [headers]   ●●●        │  │   │
│  │  │ ☑ read_file  [path]          [path] [Read]     │  │   │
│  │  │ ☐ send_email [to] [subject]  [to] [Send Email] │  │   │
│  │  │  #0D0F14  Variable chips: bg: #161922  border: #3A959A│
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Components & Hierarchy:**

```
AgentBuilderPage
├── PromptInspector (left pane, 50%)
│   ├── MonacoEditor (system prompt with syntax highlighting for {{variable}} tags)
│   └── VariableTagChips[]
│       └── TagChip (pill: bg: #161922, border: 1px #3A959A, text: #3A959A)
├── DAGGraph (right pane, 50%)
│   ├── GraphNode (input, llm, tool, output — each with type-specific icon)
│   └── Edge (animated teal line between nodes)
└── ToolBindingsPanel (bottom, collapsible)
    └── ToolBindingRow[]
        ├── Toggle switch (checkbox)
        ├── Tool name + description
        └── Variable mappings (TagChip pills mapping tool params to {{var}})
```

**States:**
- **Editing:** Monaco editor focused — border glows `#3A959A`.
- **Variable selected:** Tag chip highlighted with `#3A959A` background, white text.
- **DAG node hover:** `box-shadow: 0 0 12px rgba(58,149,154,0.3)`.
- **DAG node active/running:** Pulsing teal border animation.
- **Tool toggled on:** Row background shifts to `--surface-hover`.

**Data Flow:**
- `AgentBuilderPage` loads agent config from `AgentService.getAgent(id)`.
- Changes in Monaco are debounced (300ms) and synced via `AgentService.updateAgent(id, patch)`.
- DAG graph is computed from the agent's execution plan (static or dynamically from prompt parsing).
- Tool bindings are read from `agent.tool_configs` and updated individually.

### 3.4 Interactive Playground (`/playground`)

**File(s):** New `PlaygroundPage.tsx`, `ChatStream.tsx`, `AgentThinkingBlock.tsx`, `ToolExecutionCard.tsx`, `RawJsonDrawer.tsx`

```
┌──────────────────────────────────────────────────────────────┐
│  ┌───────────────────┬──────────────────┬──────────────────┐ │
│  │  AGENT SELECT     │  CHAT STREAM     │  RAW JSON        │ │
│  │                   │                  │  DRAWER          │ │
│  │  [▼ agent-1]      │  ┌──────────────┐│  (collapsible)   │ │
│  │  [▼ agent-2]      │  │ user: hello  ││                  │ │
│  │  [▼ agent-3]      │  │              ││  {               │ │
│  │                   │  │ ┌──────────┐ ││    "messages":   │ │
│  │  bg: #0D0F14      │  │ │⟳ Thinking│ ││    ...           │ │
│  │  border: #262B38  │  │ │...       │ ││  }               │ │
│  │                   │  │ └──────────┘ ││                  │ │
│  │  Active selection: │  │  ● #3A959A  ││  bg: #0D0F14    │ │
│  │  2px left border   │  │  shimmer    ││  color: #E2E8F0  │ │
│  │  #3A959A           │  │             ││  border: #262B38  │ │
│  │                   │  │ agent: ...   ││                  │ │
│  │                   │  │              ││  Tab toggle:     │ │
│  │                   │  │ ┌──────────┐ ││  [JSON] [Logs]   │ │
│  │                   │  │ │🔧 fetch  │ ││                  │ │
│  │                   │  │ │ Status:  │ ││                  │ │
│  │                   │  │ │ 200 OK   │ ││                  │ │
│  │                   │  │ └──────────┘ ││                  │ │
│  │                   │  └──────────────┘│                  │ │
│  │                   │                  │                  │ │
│  │                   │  [Message input] ─── [Send]         │ │
│  └───────────────────┴──────────────────┴──────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Components & Hierarchy:**

```
PlaygroundPage
├── AgentSelectorPanel (left, 220px)
│   ├── AgentSelector ("Select Agent" dropdown)
│   └── AgentInfoCard (read-only description)
├── ChatStream (center, flex: 1)
│   ├── MessageBubble[] (user = right-align, agent = left-align)
│   │   ├── TextMessage
│   │   ├── AgentThinkingBlock (collapsible, teal glow indicator)
│   │   │   ├── ShimmerLoader (during thinking)
│   │   │   └── ThoughtTrace (collapsed: "Agent is thinking..." / expanded: full text)
│   │   └── ToolExecutionCard[]
│   │       ├── ToolHeader (icon + name + status badge)
│   │       ├── ToolInput (collapsible JSON)
│   │       └── ToolOutput (collapsible JSON)
│   └── MessageInput (bottom-anchored textarea + Send button)
└── RawJsonDrawer (right, collapsible, 380px)
    ├── TabBar: [JSON] [Logs] [Headers]
    └── ContentPane (Monaco editor, read-only, color: #E2E8F0 on #0D0F14)
```

**States:**
- **Idle:** Agent selector ready, empty chat stream, "Select an agent to begin" prompt.
- **Streaming:** Message bubbles appear from the agent. `AgentThinkingBlock` shows a teal pulse animation.
- **Tool executing:** `ToolExecutionCard` appears with border gradually transitioning from `#3A959A` (running) to `#22C55E` (success) or `#EF4444` (error).
- **Thinking block collapsed:** Shows compact indicator `● Thinking...` with a `#3A959A` glowing dot.
- **Thinking block expanded:** Full chain-of-thought text is visible. Background: `#0D0F14`, text: `#94A3B8`.
- **Raw JSON drawer:** Slides in from right on toggle. Active tab underlined with `#3A959A`.

**Data Flow:**
- `PlaygroundPage` manages a conversation state array `messages[]`.
- Selecting an agent sets `activeAgentId`, which configures the chat endpoint.
- Sending a message POSTs to `AgentService.runChat(agentId, message)` (or Supabase Edge Function).
- The response streams back; each chunk updates the last message in `messages[]`.
- Tool calls are parsed from the stream and rendered as `ToolExecutionCard` children.
- Raw JSON drawer reflects the latest message's full payload.

### 3.5 Prompt Library & Tracing (`/library` & `/traces`)

**File(s):** New `PromptLibraryPage.tsx`, `TraceViewerPage.tsx`, `VersionDiff.tsx`, `TemplateVariableMatrix.tsx`

```
┌──────────────────────────────────────────────────────────────┐
│  PROMPT LIBRARY                     [Search] [+ New Prompt]  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                │   │
│  │  │ v1.2    │ │ v1.1    │ │ v1.0    │  ← Version tabs │   │
│  │  │ current │ │ prev    │ │ original│    Active: 2px   │   │
│  │  │ #3A959A │ │ #94A3B8 │ │ #64748B │    bottom border│   │
│  │  └─────────┘ └─────────┘ └─────────┘                │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Version Diff (v1.1 → v1.2)                   │  │   │
│  │  │                                                │  │   │
│  │  │  System prompt:                               │  │   │
│  │  │  You are an agent that...                     │  │   │
│  │  │ -old_line_removed                             │  │   │
│  │  │ +new_line_added    ← green (#22C55E)          │  │   │
│  │  │ +another_new_line  ← green                    │  │   │
│  │  │                                                │  │   │
│  │  │  bg: #0D0F14  text: #94A3B8                   │  │   │
│  │  │  diff removed: rgba(239,68,68,0.2)            │  │   │
│  │  │  diff added:   rgba(34,197,94,0.2)            │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Template Variable Matrix                     │  │   │
│  │  │  ┌──────────┬──────────┬──────────┬──────────┐ │  │   │
│  │  │  │ Variable │ v1.0     │ v1.1     │ v1.2     │ │  │   │
│  │  │  ├──────────┼──────────┼──────────┼──────────┤ │  │   │
│  │  │  │ context  │ "You are"│ "You are"│ "Act as" │ │  │   │
│  │  │  │ tools    │ "fetch"  │ "fetch"  │ "fetch"  │ │  │   │
│  │  │  │ memory   │ —        │ "short"  │ "long"   │ │  │   │
│  │  │  └──────────┴──────────┴──────────┴──────────┘ │  │   │
│  │  │  Headers: #161922  Cells: #0D0F14              │  │   │
│  │  │  Changed cells: bg: rgba(58,149,154,0.15)      │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────┐
│  TRACE VIEWER                            [Filter ▼] [Export] │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  12:34:56 │ agent-1 │ tool: fetch_web   200    1.2s  │   │
│  │  12:34:55 │ agent-1 │ llm: gpt-4o        ◇   3.4s  │   │
│  │  12:34:50 │ agent-1 │ run: start         ◆   0.0s  │   │
│  │  ...                                                │   │
│  │                                                     │   │
│  │  Selected trace expanded:                           │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Dark terminal logs                          │   │   │
│  │  │  $ [12:34:56] ▶ tool call: fetch_web        │   │   │
│  │  │  $ [12:34:56]   input: { "url": "..." }     │   │   │
│  │  │  $ [12:34:57]   output: 200 OK (1.2s)       │   │   │
│  │  │  #0D0F14 bg, #46B3B8 accent, #E2E8F0 text  │   │   │
│  │  │  Cyan prompt prefix: $ [timestamp] ▶        │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Components & Hierarchy:**

```
PromptLibraryPage
├── PromptSearchBar
├── PromptVersionTabs[]
│   └── VersionTab (active: bottom-border 2px #3A959A)
├── VersionDiff
│   ├── DiffLine (removed: bg rgba(239,68,68,0.2), text #EF4444)
│   └── DiffLine (added: bg rgba(34,197,94,0.2), text #22C55E)
└── TemplateVariableMatrix
    ├── MatrixHeader (version columns, bg: #161922)
    └── MatrixRow[] (variable name + cell values, changed cells highlighted)

TraceViewerPage
├── TraceFilterBar
├── TraceList
│   └── TraceRow[] (timestamp, agent, event, status, duration)
│       └── TraceDetail (expandable terminal-style log panel)
└── TraceExportButton
```

### 3.6 Existing Routes — Theming Overlay

#### 3.6.1 Auth (`/` — unauthenticated)

**File:** `frontend/src/components/Auth.tsx`

| Element | Current Style | New Style |
|---|---|---|
| Container | `padding: 20px`, `maxWidth: 400px` | Centered card: `bg: #161922`, `border: 1px solid #262B38`, `border-radius: 8px`, `max-width: 420px`, `margin: 0 auto`, `padding: 32px` |
| Headings | `<h2>` / `<h3>` default | `font: Inter 700`, `color: #E2E8F0` |
| Inputs | Browser default | `bg: #0D0F14`, `border: 1px solid #262B38`, `color: #E2E8F0`, `border-radius: 6px`, focus: `#3A959A` border |
| Buttons | Default button | Primary: `bg: #3A959A`, hover `#46B3B8` + glow |
| Error text | `color: red` | `color: #EF4444`, `bg: rgba(239,68,68,0.1)`, `padding: 8px 12px`, `border-radius: 4px` |
| Invite info | `color: #4a90d9` | `color: #3A959A`, left-border accent |

#### 3.6.2 Projects (`/projects`)

**File:** `frontend/src/components/ProjectDashboard.tsx`, `TaskList.tsx`, `MilestoneList.tsx`

| Element | Current Style | New Style |
|---|---|---|
| Page wrapper | `padding: 20px` | Full-width, content area padding |
| Feedback banner | `#dff0d8` / `#f2dede` | Success: `bg: rgba(34,197,94,0.1)`, `border: 1px solid rgba(34,197,94,0.3)`, `color: #22C55E`; Error: `bg: rgba(239,68,68,0.1)`, `border: 1px solid rgba(239,68,68,0.3)`, `color: #EF4444` |
| Create form inputs | Browser defaults | `bg: #0D0F14`, `border: 1px solid #262B38`, `color: #E2E8F0` |
| Project list items | Plain `<li>` | Card style: `bg: #0D0F14`, `border: 1px solid #262B38`, `border-radius: 6px`, `padding: 12px 16px` |
| Edit inline form | `border: 1px solid #ccc`, `bg: #f9f9f9` | `bg: #161922`, `border: 1px solid #3A959A` |
| Unread badge | `bg: red`, `color: white`, `border-radius: 50%` | `bg: #EF4444`, `font-size: 11px`, `padding: 2px 6px`, `border-radius: 4px`; or style as `#3A959A` tint badge for project-chat unreads |
| Loading state | `color: #888` | `color: #64748B`, optional shimmer animation |
| Empty state | `color: #888` | `color: #64748B`, centered with subtle icon |

#### 3.6.3 Chat (`/chat`)

**File:** `frontend/src/components/ChatLayout.tsx`, `ChatBox.tsx`

| Element | Current Style | New Style |
|---|---|---|
| Sidebar container | `bg: #f5f5f5`, `border: 1px solid #ccc` | `bg: #0D0F14`, `border: 1px solid #262B38`, `border-radius: 8px` |
| Section headers | `color: #888`, `font-size: 0.8em` | `color: #64748B`, `font-size: 11px`, `letter-spacing: 0.5px`, `text-transform: uppercase` |
| Channel/DM/Project items | Hover: `#e0e0e0`, Active: `#4a90d9` | Hover: `bg: #1E2330`, Active: `bg: #1E2330` with `2px left border #3A959A` |
| Active item text | `color: white` | `color: #E2E8F0` |
| Unread badges | `bg: red` | `bg: #EF4444` or `bg: rgba(58,149,154,0.15)` with `color: #3A959A` for channel mentions |
| Create Channel form | `bg: white`, `border: 1px solid #ddd` | `bg: #161922`, `border: 1px solid #262B38` |
| Invite People button | `bg: #4a90d9` | `bg: #3A959A`, hover `#46B3B8` + glow |
| Divider (`<hr>`) | `border-top: 1px solid #ddd` | `border-top: 1px solid #262B38` |
| Search results item | Hover via inline handler | Hover: `bg: #1E2330` |
| Main chat area | `flex: 1` | Same layout, ChatBox gets inset surface styling |
| ChatBox header | (currently none explicit) | `border-bottom: 1px solid #262B38`, `padding: 12px 16px`, `color: #E2E8F0` |
| Message area | (browser defaults) | `bg: #0B0D12`, system messages in `#94A3B8` |
| Message input | (browser default) | `bg: #0D0F14`, `border: 1px solid #262B38`, `color: #E2E8F0`, focus: `border: 1px solid #3A959A` |

#### 3.6.4 Settings (`/settings`)

**File:** `frontend/src/pages/SettingsPage.tsx`, `frontend/src/components/RoleManagement.tsx`

| Element | Current Style | New Style |
|---|---|---|
| Page wrapper | Browser defaults | `padding: 24px`, `color: #E2E8F0` |
| Section headers | `<h3>` default | `font: Inter 600 18px`, `color: #E2E8F0` |
| Create Role form | Browser defaults | Inputs: `bg: #0D0F14`, `border: 1px solid #262B38`, `color: #E2E8F0` |
| Role list items | Plain list | Card: `bg: #0D0F14`, `border: 1px solid #262B38`, `border-radius: 6px` |
| Permissions checkbox grid | Default checkboxes | Checkbox styled with `accent-color: #3A959A`, cell `bg: #0D0F14`, section `bg: #161922` |
| Edit/Delete buttons | Default buttons | Edit: `color: #3A959A`, Delete: `color: #EF4444` |
| User assignment | Browser select | `bg: #0D0F14`, `border: 1px solid #262B38`, `color: #E2E8F0` |

### 3.7 Telemetry / Status Bar

**File(s):** New `StatusBar.tsx`

```
┌──────────────────────────────────────────────────────────────┐
│  ● Connected  │  latency: 24ms  │  v1.2.3  │  ✅ realtime  │
│  ^-- #22C55E  │  ^-- #94A3B8    │  #64748B  │  ^-- #22C55E  │
│      dot       │                 │           │               │
└──────────────────────────────────────────────────────────────┘
```

**Elements:**
- **Connection Status:** Green dot + "Connected" when Supabase session is active. Red dot + "Disconnected" on error.
- **Latency:** Ping time displayed in `--text-secondary`.
- **Version:** App version from `package.json`, dim text.
- **Realtime Status:** Checkmark when subscription is active, warning when degraded.

---

## 4. Micro-Interactions & Animation States

### 4.1 Teal Glow Halos

Applied consistently to hovered/focused interactive elements:

```css
/* Focus ring for inputs, buttons, selectable items */
.element:focus-visible {
  box-shadow: 0 0 0 3px rgba(58, 149, 154, 0.25);
  border-color: #3A959A;
  outline: none;
}

/* Hover glow for primary buttons, trigger cards */
.element-primary:hover {
  box-shadow: 0 0 12px rgba(58, 149, 154, 0.3);
  border-color: #46B3B8;
}

/* Active DAG node glow */
.dag-node.active {
  box-shadow: 0 0 16px rgba(58, 149, 154, 0.4);
  border: 1px solid #46B3B8;
  animation: pulse-glow 2s ease-in-out infinite;
}
```

### 4.2 Shimmer Loading States

Used for skeleton placeholders while data loads:

```css
.shimmer {
  background: linear-gradient(
    90deg,
    #0D0F14 25%,
    #1E2330 50%,
    #0D0F14 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Applicable components:** Metrics cards (while fetching), trace table rows, agent list items, message loading indicators.

### 4.3 Left-Border Selection Indicator

Active sidebar and list items show a 2px solid teal left border:

```css
.list-item.active {
  background: #1E2330;
  border-left: 2px solid #3A959A;
  padding-left: 10px; /* reduced from 12px to accommodate border */
  transition: border-color 0.15s ease, background 0.15s ease;
}
```

**Applicable components:** Chat sidebar channels/DMs/projects, agent selector list, prompt version tabs, settings navigation.

### 4.4 Agent Thinking Pulse

During LLM inference (playground), the "Agent is thinking" indicator pulses:

```css
.thinking-dot {
  width: 8px;
  height: 8px;
  background: #3A959A;
  border-radius: 50%;
  display: inline-block;
  animation: thinking-pulse 1.2s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(58, 149, 154, 0.5);
}

@keyframes thinking-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
}
```

### 4.5 Tool Execution Card Transitions

When a tool call is made in the playground, its status card transitions:

| Status | Border Color | Background |
|---|---|---|
| Running | `#3A959A` (with pulse animation) | `#0D0F14` |
| Success | `#22C55E` | `rgba(34, 197, 94, 0.05)` |
| Error | `#EF4444` | `rgba(239, 68, 68, 0.05)` |

```css
.tool-card {
  transition: border-color 0.3s ease, background 0.3s ease;
}
.tool-card.running {
  animation: border-pulse 1.5s ease-in-out infinite;
}

@keyframes border-pulse {
  0%, 100% { border-color: #3A959A; }
  50% { border-color: #46B3B8; }
}
```

### 4.6 Command Palette Animations

```css
.command-palette-overlay {
  animation: fade-in 0.15s ease-out;
}

.command-palette-modal {
  animation: slide-down 0.2s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-down {
  from { opacity: 0; transform: translateY(-12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

### 4.7 Unread Badge Appearance

```css
.unread-badge {
  animation: badge-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes badge-pop {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
```

### 4.8 Scrollbar Styling

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #262B38;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #3A959A;
}
```

---

## 5. Route Map (Proposed)

| Path | Page Component | Purpose | Priority |
|---|---|---|---|
| `/` | Redirect → `/dashboard` | — | — |
| `/dashboard` | `DashboardPage` | Metrics, traces, agent triggers | New |
| `/projects` | `ProjectsPage` → `ProjectDashboard` | Project CRUD, tasks, milestones | Existing |
| `/chat` | `ChatPage` → `ChatLayout` → `ChatBox` | Real-time messaging | Existing |
| `/agents` | `AgentListPage` | Browse/crud agents | New |
| `/agents/:id/builder` | `AgentBuilderPage` | Prompt editor, DAG, tool bindings | New |
| `/playground` | `PlaygroundPage` | Interactive chat, thinking blocks, JSON drawer | New |
| `/library` | `PromptLibraryPage` | Versioned prompts, diff, variable matrix | New |
| `/traces` | `TraceViewerPage` | Execution traces, terminal logs | New |
| `/settings` | `SettingsPage` → `RoleManagement` | Roles, permissions | Existing |
| `*` | Redirect → `/dashboard` | Catch-all | — |

---

## 6. Implementation Notes

### 6.1 Token System (Recommended)

Create `frontend/src/theme/tokens.ts` exporting all CSS variable names as a typed object:

```typescript
export const tokens = {
  accentPrimary: '#3A959A',
  accentGlow: '#46B3B8',
  accentMuted: 'rgba(58, 149, 154, 0.15)',
  canvasBg: '#0B0D12',
  canvasGrid: '#181B24',
  surfaceInset: '#0D0F14',
  surfaceFloat: '#161922',
  surfaceHover: '#1E2330',
  borderDefault: '#262B38',
  textPrimary: '#E2E8F0',
  textSecondary: '#94A3B8',
  textDim: '#64748B',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#EAB308',
} as const;
```

### 6.2 Grid Background Utility

Apply the grid background to `.app-shell` or `body` using:

```typescript
const appShellStyle: React.CSSProperties = {
  backgroundColor: tokens.canvasBg,
  backgroundImage: `
    linear-gradient(rgba(24, 27, 36, 0.6) 1px, transparent 1px),
    linear-gradient(90deg, rgba(24, 27, 36, 0.6) 1px, transparent 1px)
  `,
  backgroundSize: '24px 24px',
};
```

### 6.3 Migration Strategy

1. Create `tokens.ts` and replace all inline color values in existing components with token references.
2. Build the new `GlobalHeader` and `Sidebar` layout shell; wrap existing routes inside it.
3. Add the telemetry `StatusBar` at the bottom.
4. Implement new pages (`DashboardPage`, `AgentBuilderPage`, `PlaygroundPage`, `PromptLibraryPage`, `TraceViewerPage`) incrementally.
5. Add `⌘K` command palette as a global keyboard shortcut listener.
6. Apply micro-interaction animations via a shared `animations.ts` or CSS-in-JS objects.
