import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { tokens, navHeight, radius, fontSize } from '../theme/tokens';

interface Props {
  userEmail?: string;
  onToggleSidebar?: () => void;
  notificationBadge?: number;
  onMarkAllRead?: () => void;
}

export default function GlobalHeader({ userEmail, onToggleSidebar, notificationBadge = 0, onMarkAllRead }: Props) {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [healthOk, setHealthOk] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/health');
        setHealthOk(res.ok);
      } catch {
        setHealthOk(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      style={{
        height: navHeight,
        background: tokens.canvasBg,
        borderBottom: `1px solid ${tokens.borderDefault}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            style={{
              background: 'none',
              border: 'none',
              color: tokens.textSecondary,
              cursor: 'pointer',
              padding: 4,
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ☰
          </button>
        )}
        <div
          onClick={() => navigate('/projects')}
          style={{
            color: tokens.textPrimary,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          Agency Management
        </div>
      </div>

      <div
        style={{
          background: tokens.surfaceFloat,
          border: `1px solid ${tokens.accentPrimary}`,
          borderRadius: radius.sm,
          padding: '2px 10px',
          color: tokens.accentPrimary,
          fontSize: 11,
          fontWeight: 600,
          lineHeight: '24px',
          cursor: 'default',
          boxShadow: '0 0 6px rgba(58, 149, 154, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 13 }}>⌘</span>K
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: tokens.textDim,
            fontSize: fontSize.sm,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: healthOk ? tokens.success : tokens.danger,
              display: 'inline-block',
            }}
          />
          <span>{healthOk ? 'API OK' : 'Degraded'}</span>
        </div>

        {/* Notification bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowNotifMenu(!showNotifMenu); if (notificationBadge > 0) onMarkAllRead?.(); }}
            style={{
              background: 'none',
              border: 'none',
              color: tokens.textSecondary,
              cursor: 'pointer',
              padding: 4,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            🔔
            {notificationBadge > 0 && (
              <span style={{
                position: 'absolute',
                top: -2,
                right: -4,
                background: tokens.danger,
                color: '#fff',
                borderRadius: '50%',
                minWidth: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1,
                padding: '0 3px',
                boxShadow: `0 0 0 2px ${tokens.canvasBg}`,
              }}>
                {notificationBadge > 99 ? '99+' : notificationBadge}
              </span>
            )}
          </button>
          {showNotifMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 8,
                background: tokens.surfaceFloat,
                border: `1px solid ${tokens.borderDefault}`,
                borderRadius: radius.lg,
                padding: 12,
                minWidth: 200,
                animation: 'slide-down 0.2s ease-out',
                zIndex: 200,
                textAlign: 'center',
              }}
            >
              <div style={{ color: tokens.textDim, fontSize: fontSize.sm }}>
                {notificationBadge > 0 ? 'Marked all as read' : 'No new notifications'}
              </div>
            </div>
          )}
        </div>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: tokens.surfaceHover,
              border: `1px solid ${tokens.borderDefault}`,
              color: tokens.textPrimary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {(userEmail || '?').charAt(0).toUpperCase()}
          </button>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 8,
                background: tokens.surfaceFloat,
                border: `1px solid ${tokens.borderDefault}`,
                borderRadius: radius.lg,
                padding: '8px 0',
                minWidth: 180,
                animation: 'slide-down 0.2s ease-out',
                zIndex: 200,
              }}
            >
              <div style={{ padding: '8px 16px', color: tokens.textSecondary, fontSize: fontSize.sm }}>
                {userEmail || 'Signed in'}
              </div>
              <div style={{ borderTop: `1px solid ${tokens.borderDefault}`, margin: '4px 0' }} />
              <button
                onClick={() => { supabase.auth.signOut(); setShowUserMenu(false); }}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  color: tokens.danger,
                  fontSize: fontSize.base,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
