import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { tokens, radius, fontSize } from '../theme/tokens';

interface InviteInfo {
  org_name: string;
  email: string;
  role: string;
  organization_id: string;
}

interface AuthProps {
  onSuccess?: (message: string) => void;
}

type Mode = 'login' | 'signup' | 'invite';

const Auth = ({ onSuccess }: AuthProps) => {
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('invite') || params.get('token') || params.get('org');

  const [mode, setMode] = useState<Mode>(inviteToken ? 'invite' : 'login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Invite signup form state
  const [fullName, setFullName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signingUp, setSigningUp] = useState(false);

  // Regular signup form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupOrgName, setSignupOrgName] = useState('');

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (inviteToken) {
      setInviteLoading(true);
      (async () => {
        try {
          const { data, error } = await supabase
            .rpc('get_invite_by_token', { p_token: inviteToken });
          if (cancelled) return;
          if (!error && Array.isArray(data) && data.length > 0) {
            const row = data[0] as any;
            setInviteInfo({
              org_name: row.organization_name,
              email: row.email,
              role: row.role || 'employee',
              organization_id: row.organization_id,
            });
          } else {
            setInviteError(true);
          }
        } catch {
          if (!cancelled) setInviteError(true);
        } finally {
          if (!cancelled) setInviteLoading(false);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const handleInviteSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setInfo('');

    if (!inviteInfo) {
      setError('Invitation details are not available.');
      return;
    }

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSigningUp(true);

    const { data, error } = await supabase.auth.signUp({
      email: inviteInfo.email,
      password: signupPassword,
      options: {
        data: {
          invite_token: inviteToken,
          full_name: fullName.trim(),
        },
      },
    });

    if (error) {
      const detail = typeof error.message === 'string' && error.message !== '{}'
        ? error.message
        : `Server error (${error.status || 500}) — check Supabase logs`;
      setError(detail);
      setSigningUp(false);
      return;
    }

    if (data.session) {
      onSuccess?.(`Welcome to ${inviteInfo.org_name}!`);
    } else {
      setInfo('Account created! Check your email (including spam) to confirm, then return here and Log In to Accept.');
    }
    setSigningUp(false);
  };

  const handleRegularSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setInfo('');

    if (!signupEmail.trim()) {
      setError('Please enter your email.');
      return;
    }

    if (!signupOrgName.trim()) {
      setError('Please enter your organization name.');
      return;
    }

    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSigningUp(true);

    const { data, error } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: {
        data: { organization_name: signupOrgName.trim() },
      },
    });

    if (error) {
      const detail = typeof error.message === 'string' && error.message !== '{}'
        ? error.message
        : `Server error (${error.status || 500}) — check Supabase logs for details`;
      setError(detail);
      setSigningUp(false);
      return;
    }

    if (data.session) {
      onSuccess?.(`Welcome to ${signupOrgName.trim()}!`);
    } else {
      setInfo('Account created! Check your email (including spam) to confirm, then Log In.');
    }
    setSigningUp(false);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setLoggingIn(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      const detail = typeof error.message === 'string' && error.message !== '{}'
        ? error.message
        : `Server error (${error.status || 500}) — check Supabase logs`;
      setError(detail);
      setLoggingIn(false);
      return;
    }

    // If arriving via an invite link, bind the existing user to the inviting org.
    if (inviteToken && inviteInfo) {
      try {
        const { error: acceptError } = await supabase.rpc('accept_invite_existing_user', {
          p_token: inviteToken,
        });
        if (!acceptError) {
          onSuccess?.(`Welcome to ${inviteInfo.org_name}!`);
        }
        // If the RPC errored (e.g. invite already processed by
        // handle_new_user trigger), the user is still authenticated.
        // Silently proceed — no error shown.
      } catch {
        // Silently ignore — trigger already handled acceptance
      }
    }
    setLoggingIn(false);
  };

  const inputStyle: React.CSSProperties = {
    background: tokens.surfaceInset,
    border: `1px solid ${tokens.borderDefault}`,
    color: tokens.textPrimary,
    borderRadius: radius.sm,
    padding: '8px 12px',
    fontSize: fontSize.base,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    marginTop: 4,
  };

  const labelStyle: React.CSSProperties = {
    color: tokens.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: 500,
    marginBottom: 4,
    display: 'block',
  };

  const primaryBtn: React.CSSProperties = {
    background: tokens.accentPrimary,
    color: '#fff',
    border: `1px solid ${tokens.accentPrimary}`,
    borderRadius: radius.sm,
    padding: '10px 16px',
    fontSize: fontSize.base,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    marginTop: 8,
    transition: 'all 0.15s ease',
  };

  const readOnlyInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: '#0D0F14',
    cursor: 'not-allowed',
    color: tokens.textSecondary,
  };

  const errorBanner: React.CSSProperties = {
    padding: '8px 12px',
    marginBottom: 16,
    borderRadius: radius.sm,
    background: 'rgba(239, 68, 68, 0.1)',
    color: tokens.danger,
    border: '1px solid rgba(239, 68, 68, 0.3)',
    fontSize: fontSize.base,
  };

  const infoBanner: React.CSSProperties = {
    padding: '8px 12px',
    marginBottom: 16,
    borderRadius: radius.sm,
    background: 'rgba(34, 197, 94, 0.1)',
    color: tokens.success,
    border: '1px solid rgba(34, 197, 94, 0.3)',
    fontSize: fontSize.base,
  };

  // -------------------------------------------
  // Render exactly ONE form based on the active mode.
  // -------------------------------------------
  const renderLogin = () => (
    <form onSubmit={handleLogin}>
      {inviteToken && inviteInfo ? (
        <>
          <h3 style={{ color: tokens.textPrimary, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
            Log In to Accept Invitation
          </h3>
          <p style={{ color: tokens.textDim, fontSize: fontSize.sm, margin: '0 0 16px' }}>
            You were invited to <strong>{inviteInfo.org_name}</strong>
          </p>
        </>
      ) : (
        <h3 style={{ color: tokens.textPrimary, fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>
          Log In
        </h3>
      )}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={loginEmail}
          onChange={(e) => setLoginEmail(e.target.value)}
          required
          style={inputStyle}
          placeholder={inviteInfo?.email || 'you@example.com'}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Password</label>
        <input
          type="password"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          required
          style={inputStyle}
        />
      </div>
      <button type="submit" disabled={loggingIn} style={primaryBtn}>
        {loggingIn ? 'Logging in...' : inviteToken ? 'Log In & Accept' : 'Log In'}
      </button>
      {inviteToken ? (
        <p style={{ color: tokens.textDim, fontSize: fontSize.sm, marginTop: 20, textAlign: 'center' }}>
          Need an account?{' '}
          <button
            type="button"
            onClick={() => setMode('invite')}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.accentPrimary,
              cursor: 'pointer',
              padding: 0,
              fontSize: fontSize.sm,
              fontWeight: 600,
            }}
          >
            Accept Invitation
          </button>
        </p>
      ) : (
        <p style={{ color: tokens.textDim, fontSize: fontSize.sm, marginTop: 20, textAlign: 'center' }}>
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => setMode('signup')}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.accentPrimary,
              cursor: 'pointer',
              padding: 0,
              fontSize: fontSize.sm,
              fontWeight: 600,
            }}
          >
            Create Account
          </button>
        </p>
      )}
    </form>
  );

  const renderInviteSignup = () => {
    if (!inviteToken) {
      return renderLogin();
    }
    if (inviteLoading) {
      return <p style={{ color: tokens.textDim, fontSize: fontSize.base }}>Verifying invitation...</p>;
    }
    if (inviteError) {
      return (
        <div style={errorBanner}>
          Invalid or expired invitation link.
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              style={{ ...primaryBtn, marginTop: 4 }}
              onClick={() => setMode('login')}
            >
              Go to Login
            </button>
          </div>
        </div>
      );
    }
    if (!inviteInfo) {
      return <p style={{ color: tokens.textDim, fontSize: fontSize.base }}>Loading invitation...</p>;
    }

    return (
      <form onSubmit={handleInviteSignup}>
        <h3 style={{ color: tokens.textPrimary, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
          You've Been Invited to Join {inviteInfo.org_name}
        </h3>
        <p style={{ color: tokens.textDim, fontSize: fontSize.sm, margin: '0 0 16px' }}>
          {inviteInfo.email}
        </p>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            style={inputStyle}
            placeholder="Jane Doe"
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Email</label>
          <input type="email" value={inviteInfo.email} readOnly style={readOnlyInputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Set Password</label>
          <input
            type="password"
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </div>
        <button type="submit" disabled={signingUp} style={primaryBtn}>
          {signingUp ? 'Creating account...' : 'Accept & Create Account'}
        </button>

        <p style={{ color: tokens.textDim, fontSize: fontSize.sm, marginTop: 20, textAlign: 'center' }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => setMode('login')}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.accentPrimary,
              cursor: 'pointer',
              padding: 0,
              fontSize: fontSize.sm,
              fontWeight: 600,
            }}
          >
            Log In to Accept
          </button>
        </p>
      </form>
    );
  };

  const renderSignup = () => (
    <form onSubmit={handleRegularSignup}>
      <h3 style={{ color: tokens.textPrimary, fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>
        Create Your Organization
      </h3>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={signupEmail}
          onChange={(e) => setSignupEmail(e.target.value)}
          required
          style={inputStyle}
          placeholder="you@company.com"
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Organization Name</label>
        <input
          type="text"
          value={signupOrgName}
          onChange={(e) => setSignupOrgName(e.target.value)}
          required
          style={inputStyle}
          placeholder="My Agency"
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Password</label>
        <input
          type="password"
          value={signupPassword}
          onChange={(e) => setSignupPassword(e.target.value)}
          required
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          style={inputStyle}
        />
      </div>
      <button type="submit" disabled={signingUp} style={primaryBtn}>
        {signingUp ? 'Creating account...' : 'Create Account'}
      </button>

      <p style={{ color: tokens.textDim, fontSize: fontSize.sm, marginTop: 20, textAlign: 'center' }}>
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => setMode('login')}
          style={{
            background: 'transparent',
            border: 'none',
            color: tokens.accentPrimary,
            cursor: 'pointer',
            padding: 0,
            fontSize: fontSize.sm,
            fontWeight: 600,
          }}
        >
          Log In
        </button>
      </p>
    </form>
  );

  return (
    <div>
      {error && <div style={errorBanner}>{error}</div>}
      {info && <div style={infoBanner}>{info}</div>}

      {/* Render exactly ONE form — never both */}
      {mode === 'login' ? renderLogin() : mode === 'signup' ? renderSignup() : renderInviteSignup()}
    </div>
  );
};

export default Auth;
