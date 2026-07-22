# Agency Management App - Development Roadmap

This document outlines the step-by-step development process to build a robust, secure, and scalable B2B SaaS application.

## Phase 1: Foundation & Authentication (The "Multi-Tenancy" Base)
- [ ] **Auth Setup:** Configure Supabase Auth providers (Email/Password).
- [ ] **Onboarding Flow:** Implement Sign-up/Login page.
- [ ] **Automatic Org Creation:** Create a Postgres Database Function (Trigger) that runs on new user sign-up to automatically:
    - Create a new entry in `organizations`.
    - Create a corresponding entry in `profiles` linking the user to that organization with `role: 'admin'`.
- [ ] **RLS Verification:** Ensure Row-Level Security (RLS) is active and tested for `organizations` and `profiles`.

## Phase 2: Project Management (The Core Workflow)
- [ ] **Project CRUD:** Build UI for creating, reading, updating, and deleting projects.
- [ ] **Scope Control:** Ensure every database query in the backend (`ProjectService`) filters by `organization_id`.
- [ ] **Project Dashboard:** Display a grid/list of projects for the organization.
- [ ] **Milestones & Tasks:** Add tables and UI for sub-tasks within projects.

## Phase 3: Real-time Collaboration (Chat)
- [ ] **Supabase Realtime:** Enable Realtime on the `messages` table.
- [ ] **Global Chat:** Implement #general channels and DM list.
- [ ] **Project Chat:** Implement project-specific chat threads.
- [ ] **Unread Indicators:** Add logic to track message read status per user.

## Phase 4: Dynamic RBAC (Roles & Permissions)
- [ ] **Permission Schema:** Expand `profiles` and `roles` tables to handle a granular Permission Matrix. roles and profiles can be unlimited. there will be no fixed limit on the number of permissions. also the organization owner can add as much roles and profiles as needed.
- [ ] **Permission Guard:** Build a middleware/hook (`usePermission`) that checks if a user has access to a feature (e.g., `can_delete_project`).
- [ ] **Role Management UI:** Build the settings interface for Admins to customize roles.

## Phase 5: Dashboards, Polish & Polish
- [ ] **Role-Based Views:** Tailor the main dashboard UI based on the user's role (Admin vs. PM vs. Employee).
- [ ] **Search:** Implement full-text search (PostgreSQL `tsvector`) across projects and messages.
- [ ] **File Uploads:** Integrate Supabase Storage for project files/attachments.
- [ ] **Audit Logging:** Implement triggers to log sensitive actions (role changes, deletions) for compliance.

---

## Development Best Practices
1.  **Safety First:** Never write a query without `organization_id` in the `WHERE` clause.
2.  **Test Early:** After building any feature, test with two different accounts in two different organizations to ensure data isolation.
3.  **Types:** Maintain strict TypeScript interfaces for all data models.
4.  **Modular:** Keep business logic in `services/` and UI in `components/`.
