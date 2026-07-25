import { useEffect, useRef } from 'react';
import { supabase } from '../api/supabaseClient';

interface TaskUpdatePayload {
  old: Record<string, unknown>;
  new: Record<string, unknown>;
}

export function useRealtimeTasks(
  organizationId: string | undefined,
  onUpdate: (payload: TaskUpdatePayload) => void,
): void {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('tasks')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tasks',
        filter: `organization_id=eq.${organizationId}`,
      }, (payload: any) => {
        callbackRef.current({ old: payload.old, new: payload.new });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);
}
