# Agency Management App — Issues & Gaps

This document catalogs all issues found during the Phase 1–3 review. Items are grouped by phase and ordered by priority.

---

## Phase 1: Foundation & Authentication

### I-1: No organization name input on signup (High)

**File:** `frontend/src/components/Auth.tsx`

The `handle_new_user()` database trigger reads `raw_user_meta_data ->> 'organization_name'` to name the new organization, but the signup form only sends email and password — it never passes any metadata. As a result, the organization name always falls back to the user's email domain (e.g. `gmail.com`).

**Fix needed:** Add an "Organization Name" field to the signup form and pass it via the `options.data` parameter of `supabase.auth.signUp()`.

---

### I-2: Session state lacks proper TypeScript type (Medium)

**File:** `frontend/src/App.tsx` (line 9)

```ts
const [session, setSession] = useState(null);
```

`session` is implicitly typed as `null` and can never hold a `Session` object without TypeScript errors. This also means downstream uses of `session` lose type safety.

**Fix needed:** Import `Session` from `@supabase/supabase-js` and type the state as `useState<Session | null>(null)`.

---

### I-3: No error handling for getSession() on app load (Medium)

**File:** `frontend/src/App.tsx` (line 13)

The `.then()` chain on `supabase.auth.getSession()` has no `.catch()`. If the network fails when the app first loads, the user silently sees a logged-out state with no error feedback.

**Fix needed:** Add a `.catch()` that sets an error state displayed in the UI.

---

### I-4: RLS policies for UPDATE and DELETE are missing (Medium)

**Files:** `database/schema.sql`, `database/chat_schema.sql`

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| organizations | ✅ | ❌ | ❌ | ❌ |
| profiles | ✅ | ✅ | ❌ | ❌ |
| projects | ✅ | ✅ | ❌ | ❌ |
| tasks | ✅ | ✅ | ✅ | ❌ |
| messages | ✅ | ✅ | ❌ | ❌ |

Most tables lack UPDATE and DELETE policies. While any authenticated org member can currently perform these operations via the client (because Supabase anon key bypasses RLS if no policy exists), the absence of explicit policies means the database cannot enforce who can modify or remove data. This will become a security concern once role-based permissions (Phase 4) are introduced.

**Fix needed:** Add RLS policies for UPDATE and DELETE on all tables, scoped by `organization_id`.

---

## Phase 2: Project Management

### I-5: Project CRUD incomplete — missing Update and Delete (High)

**Files:** `frontend/src/services/ProjectService.ts`, `frontend/src/components/ProjectDashboard.tsx`

The service only implements `createProject()` and `getProjects()`. There is no `updateProject()` or `deleteProject()` method. The dashboard has no edit or delete controls for existing projects.

**Fix needed:** Add `updateProject(id, fields)` and `deleteProject(id)` to the service, and add edit/delete buttons to the dashboard UI.

---

### I-6: Task CRUD incomplete — missing Update (status change) and Delete (High)

**Files:** `frontend/src/services/TaskService.ts`, `frontend/src/components/TaskList.tsx`

The `tasks` table has a `status` column, but the UI never updates it. Tasks cannot be marked complete, have their status changed, or be deleted.

**Fix needed:** Add `updateTask(id, fields)` and `deleteTask(id)` to the service, and add controls in `TaskList.tsx` to change task status and delete tasks.

---

### I-7: Milestones are entirely missing (High)

**Files:** `database/schema.sql`, all frontend code

Phase 2 explicitly includes "Milestones & Tasks." There is no `milestones` table in the database schema, no TypeScript interface, no service, and no UI component.

**Fix needed:** Design and create a `milestones` table (with `project_id`, `name`, `due_date`, `status`), add a service, and build a UI component to manage milestones within a project.

---

## Phase 3: Real-time Chat

### I-8: No unread indicators (High)

**File:** Entirely missing

Phase 3 requires "Unread Indicators: Add logic to track message read status per user." There is no `message_reads` table, no read-receipt logic, and no unread badge anywhere in the UI.

**Fix needed:**
- Create a `message_reads` table (or add `last_read_at` to a user-channel concept).
- Track when a user has seen messages in a channel/project.
- Display unread counts in the UI.

---

### I-9: No channel/DM sidebar — single global chat only (High)

**File:** `frontend/src/components/ChatBox.tsx`

The plan specifies "Global Chat: Implement #general channels and DM list." Currently there is only a single global chat view with no sidebar. Users cannot create channels, join them, or see a list of their direct messages.

**Fix needed:** Build a chat sidebar showing channels and DM conversations alongside the main chat window.

---

### I-10: Chat shows raw sender_id instead of user name (High)

**File:** `frontend/src/components/ChatBox.tsx` (line 60)

```tsx
<strong>{m.sender_id.substring(0, 5)}:</strong> {m.content}
```

Displays a truncated UUID like `a1b2c` instead of the sender's actual name or email. This is confusing and unusable in any real setting.

**Fix needed:**
- Include sender profile data in the messages query (e.g. `select('*, profiles(email)')`).
- Display the sender's email or a display name column.

---

### I-11: Messages query doesn't include sender profile info (Medium)

**File:** `frontend/src/services/ChatService.ts` (line 15)

```ts
supabase.from('messages').select('*')
```

No join to the `profiles` table, so the frontend cannot display sender information even if it wanted to.

**Fix needed:** Use a select like `.select('*, profiles(email, display_name)')`.

---

### I-12: No loading state in ChatBox (Low)

**File:** `frontend/src/components/ChatBox.tsx`

When the component mounts, it fetches messages with `.then(setMessages)` but shows nothing until the data arrives. Users see a blank chat area during loading.

**Fix needed:** Add a loading spinner or skeleton while messages are being fetched.

---

### I-13: No message retention or privacy boundary between projects (Medium)

**File:** `database/chat_schema.sql`

Messages from all projects within an organization are readable by any org member because the RLS policy only filters by `organization_id`. A member of Project A can read messages from Project B's chat.

**Fix needed:** Add a policy or access-check that also considers whether the user is assigned to the project.

---

### I-14: No per-project chat access control (Medium)

**File:** `database/chat_schema.sql`, `frontend/src/services/ChatService.ts`

There is no concept of which users are assigned to which project, so there is no way to restrict project-chat access to only assigned team members. The data is isolated by org but not by project within the org.

**Fix needed:** Either create a `project_members` table or add a policy that checks project assignment before allowing message reads.

---

### I-15: No thread/channel creation for organization-wide chat (High)

**File:** Entirely missing

Currently there is a single flat "Global Chat." Organizations with many employees need the ability to create dedicated channels/threads (e.g. `#general`, `#announcements`, `#random`, `#engineering`, `#marketing`) and invite specific employees to each one. This is essential for structured team communication.

**What's needed:**
- A `channels` table (id, organization_id, name, description, created_by, is_private, created_at).
- A `channel_members` table (channel_id, user_id) to control membership.
- A UI sidebar listing available channels and allowing the organization admin to create/manage them.
- The messages table should be linked to channels (via a `channel_id` foreign key) so messages are scoped within a channel rather than living in a single flat namespace.
- Private channels where only invited members can see and participate.

---

### I-16: No personal/direct messaging between organization members (High)

**File:** Entirely missing

Users within the same organization have no way to send private 1-on-1 messages to each other. The system needs a DM (direct message) system that lets any employee start a private conversation with any other employee in the same organization.

**What's needed:**
- A `dm_channels` or `conversations` table (id, organization_id, created_at) representing a private conversation.
- A `conversation_participants` table (conversation_id, user_id) to track who is in each conversation.
- A DM section in the chat sidebar listing recent conversations.
- The ability to start a new DM by searching for and selecting a user.
- Messages for DMs can either reuse the `messages` table with a `conversation_id` foreign key or go into a separate `dm_messages` table.

---

## General Issues

### I-17: Backend directory is entirely empty (Medium)

**Folder:** `backend/src/`

All five backend subdirectories (`config`, `controllers`, `middleware`, `models`, `services`) are empty. The application currently runs entirely client-side against Supabase. Any server-side logic (webhooks, complex business rules, file processing, external API integrations) would have no home.

**Fix needed:** Decide on a backend framework (e.g. Express, Fastify) and begin implementing server-side logic as needed.

---

### I-18: react-router-dom is installed but unused (Low)

**File:** `frontend/package.json`

`react-router-dom` v7 is a dependency, but `App.tsx` uses a simple `view` state string to toggle between Projects and Chat. The `pages/` directory is empty. As the app grows, nested routing (settings, user profiles, etc.) will become necessary.

**Fix needed:** Set up React Router with route components for each major page.

---

### I-19: Supabase credentials are hardcoded (Low)

**File:** `frontend/src/api/supabaseClient.ts`

The Supabase URL and anon key are hardcoded directly in source code. This makes it impossible to use different credentials per environment (development, staging, production) and risks exposing the key in version control.

**Fix needed:** Move credentials to `.env` file using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` variables, then read them via `import.meta.env`.

---

### I-20: No loading states or error boundaries in any component (Medium)

**Files:** All components

- `ProjectDashboard` — no loading state while fetching projects.
- `TaskList` — no loading state while fetching tasks.
- `ChatBox` — no loading state while fetching messages.
- None of the components have error boundaries.

**Fix needed:** Add loading spinners/skeletons and wrap the app (or sections of it) in React error boundaries.