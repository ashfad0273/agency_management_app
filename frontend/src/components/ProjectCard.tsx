import { useState } from 'react';
import { ProjectCardData } from '../services/ProjectService';
import { tokens, radius, fontSize } from '../theme/tokens';

interface Props {
  project: ProjectCardData;
  onClick: () => void;
}

function statusPill(status: string) {
  const map: Record<string, { variant: 'success' | 'warning' | 'info' | 'neutral'; label: string }> = {
    active: { variant: 'info', label: 'Active' },
    on_hold: { variant: 'warning', label: 'On Hold' },
    completed: { variant: 'success', label: 'Completed' },
  };
  const s = map[status] ?? { variant: 'neutral' as const, label: status };
  const colors = {
    info: { bg: 'rgba(58, 149, 154, 0.15)', text: tokens.accentPrimary, border: 'rgba(58, 149, 154, 0.3)' },
    success: { bg: 'rgba(34, 197, 94, 0.15)', text: tokens.success, border: 'rgba(34, 197, 94, 0.3)' },
    warning: { bg: 'rgba(234, 179, 8, 0.15)', text: tokens.warning, border: 'rgba(234, 179, 8, 0.3)' },
    neutral: { bg: 'rgba(100, 116, 139, 0.15)', text: tokens.textSecondary, border: 'rgba(100, 116, 139, 0.3)' },
  };
  const c = colors[s.variant];
  return { background: c.bg, color: c.text, border: `1px solid ${c.border}`, padding: '2px 8px', borderRadius: radius.sm, fontSize: fontSize.xs, fontWeight: 600, lineHeight: 1.4, display: 'inline-flex', alignItems: 'center' };
}

function formatDeadline(d: string | null) {
  if (!d) return null;
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ProjectCard({ project, onClick }: Props) {
  const [hovered, setHovered] = useState(false);
  const [avatarHover, setAvatarHover] = useState<string | null>(null);

  const progress = project.taskCount > 0 ? Math.round((project.completedTaskCount / project.taskCount) * 100) : 0;

  const AVATAR_LIMIT = 4;
  const visibleMembers = project.members.slice(0, AVATAR_LIMIT);
  const overflow = project.memberCount - AVATAR_LIMIT;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setAvatarHover(null); }}
      style={{
        background: tokens.surfaceFloat,
        border: `1px solid ${hovered ? tokens.accentPrimary : tokens.borderDefault}`,
        borderRadius: radius.lg,
        padding: '18px 20px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered ? `0 6px 20px rgba(58, 149, 154, 0.15)` : 'none',
      }}
    >
      {/* Header: Title + Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <h3 style={{ margin: 0, color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, lineHeight: 1.3 }}>
          {project.name}
        </h3>
        <span style={statusPill(project.status || 'active')}>
          {project.status === 'on_hold' ? 'On Hold' : project.status === 'active' ? 'Active' : project.status === 'completed' ? 'Completed' : 'Active'}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p style={{
          margin: 0,
          color: tokens.textSecondary,
          fontSize: fontSize.base,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {project.description}
        </p>
      )}

      {/* Progress Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ color: tokens.textDim, fontSize: fontSize.xs, fontWeight: 500 }}>Progress</span>
          <span style={{ color: tokens.textPrimary, fontSize: fontSize.xs, fontWeight: 600 }}>{progress}%</span>
        </div>
        <div style={{
          width: '100%',
          height: 6,
          background: tokens.surfaceInset,
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: progress === 100 ? tokens.success : tokens.accentPrimary,
            borderRadius: 3,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Footer: Deadline + Stacked Avatars */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        {/* Deadline */}
        {project.deadline && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: tokens.textDim, fontSize: fontSize.sm }}>
            <span style={{ fontSize: 13 }}>📅</span>
            <span>Due {formatDeadline(project.deadline)}</span>
          </div>
        )}
        {!project.deadline && <div />}

        {/* Stacked Avatars */}
        {project.members.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
              {visibleMembers.map((m, i) => (
                <div
                  key={m.id}
                  onMouseEnter={() => setAvatarHover(m.id)}
                  onMouseLeave={() => setAvatarHover(null)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: tokens.surfaceHover,
                    border: `2px solid ${tokens.surfaceFloat}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: tokens.textPrimary,
                    fontSize: fontSize.xs,
                    fontWeight: 600,
                    marginLeft: i > 0 ? -8 : 0,
                    position: 'relative',
                    zIndex: visibleMembers.length - i,
                    flexShrink: 0,
                  }}
                >
                  {(m.email || '?').charAt(0).toUpperCase()}
                  {avatarHover === m.id && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: 6,
                      background: tokens.surfaceFloat,
                      border: `1px solid ${tokens.borderDefault}`,
                      borderRadius: radius.sm,
                      padding: '3px 8px',
                      color: tokens.textPrimary,
                      fontSize: fontSize.xs,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      zIndex: 500,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      pointerEvents: 'none',
                    }}>
                      {m.email || 'Unknown'}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {overflow > 0 && (
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: tokens.surfaceHover,
                border: `2px solid ${tokens.surfaceFloat}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.accentPrimary,
                fontSize: fontSize.xs,
                fontWeight: 700,
                marginLeft: -8,
                zIndex: 0,
                flexShrink: 0,
              }}>
                +{overflow}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
