/**
 * Shared TypeScript types and interfaces used by the backend.
 *
 * These mirror or extend the frontend types for consistency.
 */

export interface Organization {
  id: string;
  name: string;
  domain: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  email: string | null;
  role: string;
  created_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
}