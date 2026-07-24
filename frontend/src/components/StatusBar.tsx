import { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';
import { tokens, statusBarHeight, fontSize } from '../theme/tokens';

export default function StatusBar() {
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let canceled = false;

    const measureLatency = async () => {
      const start = performance.now();
      try {
        const { error } = await supabase.from('projects').select('id').limit(1);
        if (!error && !canceled) {
          setLatency(Math.round(performance.now() - start));
        }
      } catch {
        // ignore
      }
    };

    measureLatency();
    const interval = setInterval(measureLatency, 60000);

    const channel = supabase.channel('status-bar-ping');
    channel
      .subscribe((status) => {
        if (!canceled) {
          setRealtimeConnected(status === 'SUBSCRIBED');
        }
      });

    return () => {
      canceled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <footer
      style={{
        height: statusBarHeight,
        background: tokens.surfaceInset,
        borderTop: `1px solid ${tokens.borderDefault}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: fontSize.xs,
        color: tokens.textDim,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: realtimeConnected ? tokens.success : tokens.warning,
              display: 'inline-block',
            }}
          />
          {realtimeConnected ? 'Connected' : 'Connecting...'}
        </span>
        {latency !== null && <span>latency: {latency}ms</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>v1.0.0</span>
      </div>
    </footer>
  );
}
