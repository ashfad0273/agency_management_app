import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { tokens, navHeight, radius, fontSize } from '../theme/tokens';

interface Props {
  userEmail?: string;
  onToggleSidebar?: () => void;
}

export default function GlobalHeader({ userEmail, onToggleSidebar }: Props) {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [healthOk, setHealthOk] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
