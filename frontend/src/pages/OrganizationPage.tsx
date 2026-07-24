import { useState, useEffect } from 'react';
import { RoleService } from '../services/RoleService';
import { tokens, sharedStyles, radius, fontSize } from '../theme/tokens';

interface OrgMember {
  id: string;
  email: string | null;
  role_name: string | null;
  role_id: string | null;
}

export default function OrganizationPage() {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await RoleService.getProfilesWithRoles();
      setMembers(data.map((m) => ({
        id: m.id,
        email: m.email,
        role_name: m.role_name || m.role || 'Unassigned',
        role_id: m.role_id,
      })));
    } catch (err) {
      console.error('Error loading members:', err);
    }
    setLoading(false);
  };

  const filteredMembers = members.filter((m) => {
    const email = (m.email || '').toLowerCase();
    const role = (m.role_name || '').toLowerCase();
    const q = search.toLowerCase();
    if (search && !email.includes(q) && !role.includes(q)) return false;
    if (roleFilter !== 'all' && role !== roleFilter.toLowerCase()) return false;
    return true;
  });

  const uniqueRoles = [...new Set(members.map((m) => m.role_name || 'Unassigned'))].sort();

  const roleBadgeStyle = (role: string) => {
    const variants: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
      administrator: 'info',
      admin: 'info',
      ceo: 'success',
      pm: 'warning',
      employee: 'neutral',
    };
    const key = role.toLowerCase();
    return sharedStyles.badge(variants[key] || 'neutral');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: tokens.textPrimary, fontSize: fontSize.lg, fontWeight: 600, margin: 0 }}>
            Organization Directory
          </h2>
          <p style={{ color: tokens.textDim, fontSize: fontSize.sm, margin: '4px 0 0' }}>
            {loading ? 'Loading...' : `${members.length} team member${members.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px' }}>
          <input
            placeholder="Search by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={sharedStyles.input}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ ...sharedStyles.input, width: 'auto', minWidth: 160 }}
        >
          <option value="all">All Roles</option>
          {uniqueRoles.map((r) => (
            <option key={r} value={r.toLowerCase()}>{r}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ ...sharedStyles.shimmer, height: 52, marginBottom: 6 }} />
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div style={{
          ...sharedStyles.card,
          padding: 40,
          textAlign: 'center',
          color: tokens.textDim,
          fontSize: fontSize.base,
        }}>
          {search || roleFilter !== 'all' ? 'No members match your search.' : 'No team members found.'}
        </div>
      ) : (
        <div style={{
          background: tokens.surfaceFloat,
          border: `1px solid ${tokens.borderDefault}`,
          borderRadius: radius.lg,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fontSize.base }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.borderDefault}` }}>
                <th style={thStyle}>Member</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => (
                <tr key={m.id} style={{
                  borderBottom: `1px solid ${tokens.borderDefault}`,
                  transition: 'background 0.15s',
                }}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: tokens.surfaceHover,
                        border: `1px solid ${tokens.borderDefault}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: tokens.textPrimary,
                        fontSize: fontSize.sm,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}>
                        {(m.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ color: tokens.textPrimary, fontWeight: 500 }}>
                          {m.email ? m.email.split('@')[0] : 'Unknown'}
                        </div>
                        <div style={{ color: tokens.textDim, fontSize: fontSize.sm }}>
                          {m.email || 'No email'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={roleBadgeStyle(m.role_name || '')}>
                      {m.role_name || 'Unassigned'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: tokens.success,
                        display: 'inline-block',
                      }} />
                      <span style={{ color: tokens.textSecondary, fontSize: fontSize.sm }}>Active</span>
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={{ color: tokens.textDim, fontSize: fontSize.xs }}>
                      ID: {m.id.substring(0, 8)}...
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  color: tokens.textDim,
  fontSize: fontSize.sm,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  textAlign: 'left',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'middle',
};
