export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; domain: string | null; created_at: string };
        Insert: { id?: string; name: string; domain?: string | null; created_at?: string };
        Update: { id?: string; name?: string; domain?: string | null; created_at?: string };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; organization_id: string; email: string | null; role: string; role_id: string | null; created_at: string };
        Insert: { id: string; organization_id: string; email?: string | null; role?: string; role_id?: string | null; created_at?: string };
        Update: { id?: string; organization_id?: string; email?: string | null; role?: string; role_id?: string | null; created_at?: string };
      };
      projects: {
        Row: { id: string; organization_id: string; name: string; description: string | null; created_at: string };
        Insert: { id?: string; organization_id: string; name: string; description?: string | null; created_at?: string };
        Update: { id?: string; organization_id?: string; name?: string; description?: string | null; created_at?: string };
      };
      tasks: {
        Row: { id: string; project_id: string; organization_id: string; title: string; status: string; created_at: string };
        Insert: { id?: string; project_id: string; organization_id: string; title: string; status?: string; created_at?: string };
        Update: { id?: string; project_id?: string; organization_id?: string; title?: string; status?: string; created_at?: string };
      };
      milestones: {
        Row: { id: string; project_id: string; organization_id: string; name: string; description: string | null; due_date: string | null; status: string; created_at: string };
        Insert: { id?: string; project_id: string; organization_id: string; name: string; description?: string | null; due_date?: string | null; status?: string; created_at?: string };
        Update: { id?: string; project_id?: string; organization_id?: string; name?: string; description?: string | null; due_date?: string | null; status?: string; created_at?: string };
      };
      project_members: {
        Row: { id: string; project_id: string; user_id: string; organization_id: string; role: string; joined_at: string };
        Insert: { id?: string; project_id: string; user_id: string; organization_id: string; role?: string; joined_at?: string };
        Update: { id?: string; project_id?: string; user_id?: string; organization_id?: string; role?: string; joined_at?: string };
      };
      invitations: {
        Row: { id: string; organization_id: string; organization_name: string; email: string; token: string; invited_by: string | null; role: string; status: string; created_at: string; expires_at: string };
        Insert: { id?: string; organization_id: string; organization_name: string; email: string; token?: string; invited_by?: string | null; role?: string; status?: string; created_at?: string; expires_at?: string };
        Update: { id?: string; organization_id?: string; organization_name?: string; email?: string; token?: string; invited_by?: string | null; role?: string; status?: string; created_at?: string; expires_at?: string };
      };
      channels: {
        Row: { id: string; organization_id: string; name: string; description: string | null; created_by: string | null; is_private: boolean; created_at: string };
        Insert: { id?: string; organization_id: string; name: string; description?: string | null; created_by?: string | null; is_private?: boolean; created_at?: string };
        Update: { id?: string; organization_id?: string; name?: string; description?: string | null; created_by?: string | null; is_private?: boolean; created_at?: string };
      };
      channel_members: {
        Row: { id: string; channel_id: string; user_id: string; organization_id: string; role: string; joined_at: string };
        Insert: { id?: string; channel_id: string; user_id: string; organization_id: string; role?: string; joined_at?: string };
        Update: { id?: string; channel_id?: string; user_id?: string; organization_id?: string; role?: string; joined_at?: string };
      };
      conversations: {
        Row: { id: string; organization_id: string; created_at: string };
        Insert: { id?: string; organization_id: string; created_at?: string };
        Update: { id?: string; organization_id?: string; created_at?: string };
      };
      conversation_participants: {
        Row: { id: string; conversation_id: string; user_id: string; organization_id: string; joined_at: string };
        Insert: { id?: string; conversation_id: string; user_id: string; organization_id: string; joined_at?: string };
        Update: { id?: string; conversation_id?: string; user_id?: string; organization_id?: string; joined_at?: string };
      };
      messages: {
        Row: { id: string; organization_id: string; project_id: string | null; channel_id: string | null; conversation_id: string | null; sender_id: string; content: string; created_at: string };
        Insert: { id?: string; organization_id: string; project_id?: string | null; channel_id?: string | null; conversation_id?: string | null; sender_id: string; content: string; created_at?: string };
        Update: { id?: string; organization_id?: string; project_id?: string | null; channel_id?: string | null; conversation_id?: string | null; sender_id?: string; content?: string; created_at?: string };
      };
      message_reads: {
        Row: { id: string; user_id: string; organization_id: string; project_id: string | null; channel_id: string | null; conversation_id: string | null; last_read_at: string };
        Insert: { id?: string; user_id: string; organization_id: string; project_id?: string | null; channel_id?: string | null; conversation_id?: string | null; last_read_at?: string };
        Update: { id?: string; user_id?: string; organization_id?: string; project_id?: string | null; channel_id?: string | null; conversation_id?: string | null; last_read_at?: string };
      };
      permissions: {
        Row: { key: string; name: string; description: string; group_name: string };
        Insert: { key: string; name: string; description?: string; group_name: string };
        Update: { key?: string; name?: string; description?: string; group_name?: string };
      };
      roles: {
        Row: { id: string; organization_id: string; name: string; description: string; is_system: boolean; created_at: string };
        Insert: { id?: string; organization_id: string; name: string; description?: string; is_system?: boolean; created_at?: string };
        Update: { id?: string; organization_id?: string; name?: string; description?: string; is_system?: boolean; created_at?: string };
      };
      role_permissions: {
        Row: { role_id: string; permission_key: string; created_at: string };
        Insert: { role_id: string; permission_key: string; created_at?: string };
        Update: { role_id?: string; permission_key?: string; created_at?: string };
      };
    };
    Views: {};
    Functions: {
      get_user_organization_id: { Args: Record<string, never>; Returns: string };
      get_invite_by_token: { Args: { p_token: string }; Returns: { organization_name: string; email: string }[] };
      get_user_permissions: { Args: { p_user_id: string }; Returns: { permission_key: string }[] };
      user_has_permission: { Args: { p_user_id: string; p_permission: string }; Returns: boolean };
      upsert_message_read: {
        Args: { p_user_id: string; p_organization_id: string; p_project_id?: string; p_channel_id?: string; p_conversation_id?: string };
        Returns: void;
      };
      is_conversation_participant: { Args: { conv_id: string; uid: string }; Returns: boolean };
      seed_default_roles: { Args: { p_org_id: string }; Returns: string[] };
    };
    Enums: {};
    CompositeTypes: {};
  };
}
