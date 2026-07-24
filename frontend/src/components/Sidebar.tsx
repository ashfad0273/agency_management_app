import { useLocation, useNavigate } from 'react-router-dom';
import { tokens, sidebarWidth, fontSize, radius } from '../theme/tokens';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Projects', path: '/projects', icon: '📋' },
  { label: 'Chat', path: '/chat', icon: '💬' },
  { label: 'Settings', path: '/settings', icon: '⚙' },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <aside
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        background: tokens.surfaceInset,
        borderRight: `1px solid ${tokens.borderDefault}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Org label */}
      <div
        style={{
          padding: '16px 16px 12px',
          color: tokens.textDim,
          fontSize: fontSize.xs,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Organization
      </div>

      {/* Nav items */}
      <nav style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: active ? '8px 16px 8px 14px' : '8px 16px',
                borderRadius: radius.sm,
                cursor: 'pointer',
                background: active ? tokens.surfaceHover : 'transparent',
                color: active ? tokens.textPrimary : tokens.textSecondary,
                fontWeight: active ? 600 : 400,
                fontSize: fontSize.base,
                borderLeft: active ? `2px solid ${tokens.accentPrimary}` : '2px solid transparent',
                transition: 'all 0.15s ease',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
