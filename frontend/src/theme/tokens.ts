import { CSSProperties } from 'react';

export const tokens = {
  accentPrimary: '#3A959A',
  accentGlow: '#46B3B8',
  accentMuted: 'rgba(58, 149, 154, 0.15)',
  canvasBg: '#0B0D12',
  canvasGrid: '#181B24',
  surfaceInset: '#0D0F14',
  surfaceFloat: '#161922',
  surfaceHover: '#1E2330',
  borderDefault: '#262B38',
  textPrimary: '#E2E8F0',
  textSecondary: '#94A3B8',
  textDim: '#64748B',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#EAB308',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fontSize = {
  xs: '11px',
  sm: '12px',
  base: '13px',
  md: '14px',
  lg: '18px',
  xl: '24px',
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
} as const;

export const navHeight = 48;
export const statusBarHeight = 28;
export const sidebarWidth = 220;
export const sidebarCollapsedWidth = 56;

export const gridBackground: CSSProperties = {
  backgroundColor: tokens.canvasBg,
  backgroundImage: `
    linear-gradient(rgba(24, 27, 36, 0.6) 1px, transparent 1px),
    linear-gradient(90deg, rgba(24, 27, 36, 0.6) 1px, transparent 1px)
  `,
  backgroundSize: '24px 24px',
};

export const sharedStyles = {
  card: {
    background: tokens.surfaceInset,
    border: `1px solid ${tokens.borderDefault}`,
    borderRadius: radius.md,
  } as CSSProperties,
  cardFloating: {
    background: tokens.surfaceFloat,
    border: `1px solid ${tokens.borderDefault}`,
    borderRadius: radius.lg,
  } as CSSProperties,
  input: {
    background: tokens.surfaceInset,
    border: `1px solid ${tokens.borderDefault}`,
    color: tokens.textPrimary,
    borderRadius: radius.sm,
    padding: '8px 12px',
    fontSize: fontSize.base,
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    width: '100%',
    boxSizing: 'border-box' as const,
  } as CSSProperties,
  inputFocus: {
    borderColor: tokens.accentPrimary,
    boxShadow: `0 0 0 3px rgba(58, 149, 154, 0.1)`,
  } as CSSProperties,
  btnPrimary: {
    background: tokens.accentPrimary,
    color: '#fff',
    border: `1px solid ${tokens.accentPrimary}`,
    borderRadius: radius.sm,
    padding: '8px 16px',
    fontSize: fontSize.base,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,
  btnPrimaryHover: {
    background: tokens.accentGlow,
    borderColor: tokens.accentGlow,
    boxShadow: `0 0 12px rgba(58, 149, 154, 0.3)`,
  } as CSSProperties,
  btnDanger: {
    background: 'transparent',
    color: tokens.danger,
    border: `1px solid ${tokens.danger}`,
    borderRadius: radius.sm,
    padding: '4px 10px',
    fontSize: fontSize.sm,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,
  btnGhost: {
    background: 'transparent',
    color: tokens.textSecondary,
    border: `1px solid ${tokens.borderDefault}`,
    borderRadius: radius.sm,
    padding: '4px 10px',
    fontSize: fontSize.sm,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,
  label: {
    color: tokens.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as CSSProperties,
  textMuted: {
    color: tokens.textDim,
    fontSize: fontSize.sm,
  } as CSSProperties,
  divider: {
    border: 'none',
    borderTop: `1px solid ${tokens.borderDefault}`,
    margin: `${spacing.sm}px 0`,
  } as CSSProperties,
  link: {
    color: tokens.accentPrimary,
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'color 0.15s ease',
  } as CSSProperties,
  feedbackBanner: (type: 'success' | 'error') => ({
    padding: '10px 16px',
    marginBottom: '16px',
    borderRadius: radius.md,
    background: type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
    color: type === 'success' ? tokens.success : tokens.danger,
    border: `1px solid ${type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
    fontSize: fontSize.base,
  } as CSSProperties),
  badge: (variant: 'success' | 'error' | 'warning' | 'info' | 'neutral') => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      success: { bg: 'rgba(34, 197, 94, 0.15)', text: tokens.success, border: 'rgba(34, 197, 94, 0.3)' },
      error: { bg: 'rgba(239, 68, 68, 0.15)', text: tokens.danger, border: 'rgba(239, 68, 68, 0.3)' },
      warning: { bg: 'rgba(234, 179, 8, 0.15)', text: tokens.warning, border: 'rgba(234, 179, 8, 0.3)' },
      info: { bg: tokens.accentMuted, text: tokens.accentPrimary, border: `rgba(58, 149, 154, 0.3)` },
      neutral: { bg: 'rgba(100, 116, 139, 0.15)', text: tokens.textSecondary, border: 'rgba(100, 116, 139, 0.3)' },
    };
    const c = colors[variant];
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: radius.sm,
      fontSize: fontSize.xs,
      fontWeight: 600,
      lineHeight: 1.4,
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
    } as CSSProperties;
  },
  unreadBadge: {
    background: tokens.danger,
    color: '#fff',
    borderRadius: radius.sm,
    padding: '2px 6px',
    fontSize: fontSize.xs,
    fontWeight: 600,
    lineHeight: 1,
    animation: 'badge-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
  } as CSSProperties,
  shimmer: {
    background: `linear-gradient(90deg, ${tokens.surfaceInset} 25%, ${tokens.surfaceHover} 50%, ${tokens.surfaceInset} 75%)`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s ease-in-out infinite',
    borderRadius: radius.sm,
  } as CSSProperties,
  activeLeftBorder: {
    borderLeft: `2px solid ${tokens.accentPrimary}`,
    paddingLeft: '10px',
  } as CSSProperties,
};

const style = document.createElement('style');
style.textContent = `
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes badge-pop {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  @keyframes thinking-pulse {
    0%, 100% { opacity: 0.4; transform: scale(0.9); }
    50% { opacity: 1; transform: scale(1.1); }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes border-pulse {
    0%, 100% { border-color: #3A959A; }
    50% { border-color: #46B3B8; }
  }
  @keyframes slide-down {
    from { opacity: 0; transform: translateY(-12px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes slide-in-right {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #262B38; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #3A959A; }
  *:focus-visible {
    box-shadow: 0 0 0 3px rgba(58, 149, 154, 0.25);
    border-color: #3A959A;
    outline: none;
  }
  body {
    margin: 0;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
`;
document.head.appendChild(style);
