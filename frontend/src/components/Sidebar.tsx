import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tokens, sidebarWidth, sidebarCollapsedWidth, fontSize, radius } from '../theme/tokens';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: 'WORKSPACE',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: '📊' },
      { label: 'Projects', path: '/projects', icon: '📋' },
      { label: 'Chat', path: '/chat', icon: '💬' },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      { label: 'Organization', path: '/organization', icon: '🏢' },
      { label: 'Invitations', path: '/invitations', icon: '📩' },
      { label: 'Settings', path: '/settings', icon: '⚙' },
    ],
  },
];

interface Props {
  collapsed?: boolean;
}

export default function Sidebar({ collapsed = false }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const width = collapsed ? sidebarCollapsedWidth : sidebarWidth;

  return (
    <aside
      style={{
        width,
        minWidth: width,
        background: tokens.surfaceInset,
        borderRight: `1px solid ${tokens.borderDefault}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.3s ease-in-out, min-width 0.3s ease-in-out',
      }}
    >
      <nav style={{ padding: '8px', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: 16 }}>
            {/* Section header - hidden when collapsed */}
            <div
              style={{
                padding: collapsed ? '8px 0' : '8px 10px 6px',
                color: tokens.textDim,
                fontSize: fontSize.xs,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textAlign: collapsed ? 'center' : 'left',
                transition: 'opacity 0.2s ease-in-out',
                opacity: collapsed ? 0 : 1,
              }}
            >
              {collapsed ? '···' : section.title}
            </div>

            {section.items.map((item) => {
              const active = isActive(item.path);
              return (
                <div
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  onMouseEnter={() => setHoveredItem(item.path)}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 10,
                    padding: collapsed ? '10px 0' : active ? '8px 14px 8px 12px' : '8px 14px',
                    borderRadius: radius.sm,
                    cursor: 'pointer',
                    background: active ? tokens.surfaceHover : hoveredItem === item.path && !collapsed ? tokens.surfaceHover : 'transparent',
                    color: active ? tokens.textPrimary : tokens.textSecondary,
                    fontWeight: active ? 600 : 400,
                    fontSize: fontSize.base,
                    borderLeft: active && !collapsed ? `2px solid ${tokens.accentPrimary}` : '2px solid transparent',
                    marginBottom: 2,
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                    position: 'relative',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                  {/* Label - fades out when collapsed */}
                  <span
                    style={{
                      opacity: collapsed ? 0 : 1,
                      transition: 'opacity 0.2s ease-in-out',
                      overflow: 'hidden',
                    }}
                  >
                    {!collapsed && item.label}
                  </span>

                  {/* Tooltip on hover when collapsed */}
                  {collapsed && hoveredItem === item.path && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '100%',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        marginLeft: 10,
                        background: tokens.surfaceFloat,
                        border: `1px solid ${tokens.borderDefault}`,
                        borderRadius: radius.sm,
                        padding: '5px 10px',
                        color: tokens.textPrimary,
                        fontSize: fontSize.sm,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        zIndex: 300,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        pointerEvents: 'none',
                      }}
                    >
                      {item.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
