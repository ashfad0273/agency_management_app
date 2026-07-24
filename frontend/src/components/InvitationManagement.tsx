import { useState, useEffect, FormEvent } from 'react';
import { InviteService, Invitation } from '../services/InviteService';
import { usePermission, Permissions } from '../hooks/usePermission';
import { tokens, sharedStyles, radius, fontSize } from '../theme/tokens';

export default function InvitationManagement() {
  const { can } = usePermission();
  const canInvite = can(Permissions.User.Invite);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [sending, setSending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const data = await InviteService.getAllInvitations();
      setInvitations(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error loading invitations:', msg);
      showFeedback('error', `Failed to load invitations: ${msg}`);
    }
    setLoading(false);
  };

  const handleSendInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      const { emailSent, link } = await InviteService.createInvitation(inviteEmail.trim());
      setInviteEmail('');
      setShowModal(false);
      if (emailSent) {
        showFeedback('success', 'Invitation sent!');
      } else {
        showFeedback('success', `Invitation link created! Share this: ${link}`);
      }
      loadInvitations();
    } catch (err) {
      showFeedback('error', 'Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setSending(false);
  };

  const handleResend = async (invitation: Invitation) => {
    setResendingId(invitation.id);
    try {
      const { emailSent, link } = await InviteService.createInvitation(invitation.email);
      if (emailSent) {
        showFeedback('success', 'Invitation resent!');
      } else {
        showFeedback('success', `Invitation link recreated! Share this: ${link}`);
      }
      loadInvitations();
    } catch (err) {
      showFeedback('error', 'Error resending: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setResendingId(null);
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Revoke this invitation? The recipient will no longer be able to accept.')) return;
    setRevokingId(id);
    try {
      await InviteService.cancelInvitation(id);
      showFeedback('success', 'Invitation revoked');
      loadInvitations();
    } catch (err) {
      showFeedback('error', 'Error revoking: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setRevokingId(null);
  };

  const statusBadge = (status: string) => {
    const variantMap: Record<string, 'warning' | 'info' | 'neutral' | 'success'> = {
      pending: 'warning',
      accepted: 'success',
      expired: 'neutral',
      cancelled: 'neutral',
    };
    return sharedStyles.badge(variantMap[status] || 'neutral');
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: tokens.textPrimary, fontSize: fontSize.lg, fontWeight: 600, margin: 0 }}>
            Team Invitations
          </h2>
          <p style={{ color: tokens.textDim, fontSize: fontSize.sm, margin: '4px 0 0' }}>
            Manage who has access to your organization
          </p>
        </div>
        {canInvite && (
          <button
            onClick={() => { setShowModal(true); setInviteEmail(''); setInviteRole('employee'); }}
            style={sharedStyles.btnPrimary}
          >
            + Invite Member
          </button>
        )}
      </div>

      {feedback && (
        <div style={{ ...sharedStyles.feedbackBanner(feedback.type), marginBottom: 16 }}>
          {feedback.message}
        </div>
      )}

      {/* Invite Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fade-in 0.15s ease-out',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: tokens.surfaceFloat,
              border: `1px solid ${tokens.borderDefault}`,
              borderRadius: radius.lg,
              padding: 24,
              width: 420,
              maxWidth: '90vw',
              animation: 'slide-down 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, margin: '0 0 16px' }}>
              Invite a Team Member
            </h3>
            <form onSubmit={handleSendInvite}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ color: tokens.textSecondary, fontSize: fontSize.sm, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                  autoFocus
                  style={sharedStyles.input}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ color: tokens.textSecondary, fontSize: fontSize.sm, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={sharedStyles.input}
                >
                  <option value="employee">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={sharedStyles.btnGhost}>
                  Cancel
                </button>
                <button type="submit" disabled={sending} style={{ ...sharedStyles.btnPrimary, opacity: sending ? 0.6 : 1 }}>
                  {sending ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ ...sharedStyles.textMuted, padding: 40, textAlign: 'center' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ ...sharedStyles.shimmer, height: 32, marginBottom: 8 }} />
          ))}
        </div>
      ) : invitations.length === 0 ? (
        <div style={{
          ...sharedStyles.card,
          padding: 40,
          textAlign: 'center',
          color: tokens.textDim,
          fontSize: fontSize.base,
        }}>
          No invitations sent yet.
          {canInvite && (
            <div style={{ marginTop: 8 }}>
              <button onClick={() => setShowModal(true)} style={sharedStyles.link}>
                Invite your first team member
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          ...sharedStyles.card,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fontSize.base }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.borderDefault}` }}>
                <th style={{ ...thStyle }}>Email</th>
                <th style={{ ...thStyle }}>Role</th>
                <th style={{ ...thStyle }}>Status</th>
                <th style={{ ...thStyle }}>Sent</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} style={{
                  borderBottom: `1px solid ${tokens.borderDefault}`,
                  transition: 'background 0.15s',
                }}>
                  <td style={{ ...tdStyle, color: tokens.textPrimary }}>{inv.email}</td>
                  <td style={tdStyle}>
                    <span style={{ color: tokens.textSecondary, textTransform: 'capitalize' }}>
                      {inv.role}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={statusBadge(inv.status)}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: tokens.textDim, fontSize: fontSize.sm }}>
                    {formatDate(inv.created_at)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {inv.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleResend(inv)}
                            disabled={resendingId === inv.id}
                            style={{
                              ...sharedStyles.btnGhost,
                              padding: '4px 8px',
                              fontSize: fontSize.xs,
                              opacity: resendingId === inv.id ? 0.5 : 1,
                            }}
                          >
                            {resendingId === inv.id ? '...' : 'Resend'}
                          </button>
                          <button
                            onClick={() => handleRevoke(inv.id)}
                            disabled={revokingId === inv.id}
                            style={{
                              ...sharedStyles.btnDanger,
                              padding: '4px 8px',
                              fontSize: fontSize.xs,
                              opacity: revokingId === inv.id ? 0.5 : 1,
                            }}
                          >
                            {revokingId === inv.id ? '...' : 'Revoke'}
                          </button>
                        </>
                      )}
                      {inv.status === 'accepted' && (
                        <span style={{ color: tokens.textDim, fontSize: fontSize.xs }}>—</span>
                      )}
                      {inv.status === 'expired' && (
                        <button
                          onClick={() => handleResend(inv)}
                          disabled={resendingId === inv.id}
                          style={{
                            ...sharedStyles.btnGhost,
                            padding: '4px 8px',
                            fontSize: fontSize.xs,
                            opacity: resendingId === inv.id ? 0.5 : 1,
                          }}
                        >
                          {resendingId === inv.id ? '...' : 'Resend'}
                        </button>
                      )}
                    </div>
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
  padding: '10px 14px',
  color: tokens.textDim,
  fontSize: fontSize.sm,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  textAlign: 'left',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'middle',
};
