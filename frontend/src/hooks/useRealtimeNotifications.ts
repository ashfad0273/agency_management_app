import { useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

interface NotificationPayload {
  id: string;
  organization_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export function useRealtimeNotifications(
  userId: string | undefined,
  onNotification: (notification: NotificationPayload) => void,
): void {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('notifications')
      .on<NotificationPayload>('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        onNotification(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
