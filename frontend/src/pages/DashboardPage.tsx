import { useState, useEffect } from 'react';
import { ProjectService, Project } from '../services/ProjectService';
import { tokens, sharedStyles, radius, fontSize } from '../theme/tokens';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ProjectService.getProjects()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const metrics = [
    { label: 'Active Projects', value: projects.length.toString(), icon: '📋' },
    { label: 'Team Members', value: '—', icon: '👥' },
    { label: 'Pending Tasks', value: '—', icon: '📌' },
    { label: 'Completion Rate', value: '—', icon: '📈' },
  ];

  const recentActivity = [
    { time: 'Today', items: ['Project status updated', 'New member joined'] },
    { time: 'Yesterday', items: ['Milestone completed: Q2 Review'] },
  ];

  return (
    <div>
      <h2 style={{ color: tokens.textPrimary, fontSize: fontSize.lg, fontWeight: 600, margin: '0 0 24px' }}>
        Dashboard
      </h2>

      {/* Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{
            background: tokens.surfaceFloat,
            border: `1px solid ${tokens.borderDefault}`,
            borderRadius: radius.lg,
            padding: '16px 20px',
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{m.icon}</div>
            <div style={{ color: tokens.textPrimary, fontSize: fontSize.xl, fontWeight: 700, lineHeight: 1.2 }}>
              {loading ? '...' : m.value}
            </div>
            <div style={{ color: tokens.textDim, fontSize: fontSize.sm, marginTop: 4 }}>{m.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent Activity */}
        <div style={{
          background: tokens.surfaceFloat,
          border: `1px solid ${tokens.borderDefault}`,
          borderRadius: radius.lg,
          padding: 20,
        }}>
          <h3 style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, margin: '0 0 16px' }}>
            Recent Activity
          </h3>
          {recentActivity.map((group) => (
            <div key={group.time} style={{ marginBottom: 12 }}>
              <div style={{ color: tokens.textDim, fontSize: fontSize.xs, fontWeight: 600, marginBottom: 6 }}>
                {group.time}
              </div>
              {group.items.map((item, i) => (
                <div key={i} style={{
                  color: tokens.textSecondary,
                  fontSize: fontSize.base,
                  padding: '6px 10px',
                  background: tokens.surfaceInset,
                  borderRadius: radius.sm,
                  marginBottom: 4,
                  borderLeft: `2px solid ${tokens.accentPrimary}`,
                }}>
                  {item}
                </div>
              ))}
            </div>
          ))}
          {!loading && projects.length === 0 && (
            <div style={{ color: tokens.textDim, fontSize: fontSize.sm, textAlign: 'center', padding: 20 }}>
              No recent activity. Create a project to get started!
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{
          background: tokens.surfaceFloat,
          border: `1px solid ${tokens.borderDefault}`,
          borderRadius: radius.lg,
          padding: 20,
        }}>
          <h3 style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, margin: '0 0 16px' }}>
            Active Projects
          </h3>
          {loading ? (
            <div style={{ ...sharedStyles.textMuted }}>Loading...</div>
          ) : projects.length === 0 ? (
            <div style={{ color: tokens.textDim, fontSize: fontSize.sm, textAlign: 'center', padding: 20 }}>
              No projects yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projects.slice(0, 5).map((p) => (
                <div key={p.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: tokens.surfaceInset,
                  border: `1px solid ${tokens.borderDefault}`,
                  borderRadius: radius.sm,
                  padding: '10px 14px',
                }}>
                  <div>
                    <div style={{ color: tokens.textPrimary, fontSize: fontSize.base, fontWeight: 500 }}>{p.name}</div>
                    {p.description && (
                      <div style={{ color: tokens.textDim, fontSize: fontSize.xs, marginTop: 2 }}>{p.description}</div>
                    )}
                  </div>
                  <span style={{ ...sharedStyles.badge('info'), fontSize: fontSize.xs }}>Active</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
