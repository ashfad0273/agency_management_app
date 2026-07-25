import { useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

export function useRealtimeProjects(
  organizationId: string | undefined,
  onUpdate: (project: Record<string, unknown>) => void,
  onInsert?: (project: Record<string, unknown>) => void,
): void {
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('projects')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: `organization_id=eq.${organizationId}`,
      }, (payload: any) => {
        onUpdate(payload.new);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'projects',
        filter: `organization_id=eq.${organizationId}`,
      }, (payload: any) => {
        onInsert?.(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);
}
