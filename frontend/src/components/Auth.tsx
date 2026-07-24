import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { tokens, radius, fontSize } from '../theme/tokens';

const Auth = () => {
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('invite');

  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupOrgName, setSignupOrgName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [error, setError] = useState('');
  const [inviteInfo, setInviteInfo] = useState<{ org_name: string } | null>(null);
  const [inviteError, setInviteError] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  React.useEffect(() => {
    if (inviteToken) {
      (async () => {
        try {
          const { data, error } = await supabase
            .rpc('get_invite_by_token', { p_token: inviteToken });
          if (!error && data && data.length > 0) {
            const row = data[0] as { organization_name: string; email: string };
            setInviteInfo({ org_name: row.organization_name });
            setSignupEmail(row.email);
          } else {
            setInviteError(true);
          }
        } catch {
          setInviteError(true);
        }
      })();
    }
  }, [inviteToken]);

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setSigningUp(true);
    setError('');

    const options: any = {};

    if (inviteToken) {
      options.data = { invite_token: inviteToken };
    } else {
      options.data = { organization_name: signupOrgName };
    }

    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options,
    });

    if (error) setError(error.message);
    else alert('Sign up successful! Please check your email to confirm.');
    setSigningUp(false);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoggingIn(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) setError(error.message);
    setLoggingIn(false);
  };

  const inputStyle = {
    background: tokens.surfaceInset,
    border: `1px solid ${tokens.borderDefault}`,
    color: tokens.textPrimary,
    borderRadius: radius.sm,
    padding: '8px 12px',
    fontSize: fontSize.base,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    marginTop: 4,
  };

  const labelStyle = {
    color: tokens.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: 500,
    marginBottom: 4,
    display: 'block',
  };

  const btnStyle = {
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

  const inputReadOnlyStyle = inviteInfo ? { ...inputStyle, background: '#161922', cursor: 'not-allowed' } : inputStyle;

  return (
    <div>
      {error && (
        <div style={{
          padding: '8px 12px',
          marginBottom: 16,
          borderRadius: radius.sm,
          background: 'rgba(239, 68, 68, 0.1)',
          color: tokens.danger,
          border: '1px solid rgba(239, 68, 68, 0.3)',
          fontSize: fontSize.base,
        }}>
          {error}
        </div>
      )}

      {inviteToken && inviteInfo && (
        <div style={{
          padding: '10px 14px',
          marginBottom: 16,
          borderRadius: radius.sm,
          background: tokens.accentMuted,
          color: tokens.accentPrimary,
          border: `1px solid rgba(58, 149, 154, 0.3)`,
          fontSize: fontSize.base,
          fontWeight: 600,
          borderLeft: `2px solid ${tokens.accentPrimary}`,
        }}>
          You've been invited to join <strong>{inviteInfo.org_name}</strong>
        </div>
      )}

      {inviteToken && !inviteInfo && !inviteError && (
        <p style={{ color: tokens.textDim, fontSize: fontSize.base }}>Verifying invitation...</p>
      )}

      {inviteToken && inviteError && (
        <div style={{
          padding: '8px 12px',
          marginBottom: 16,
          borderRadius: radius.sm,
          background: 'rgba(239, 68, 68, 0.1)',
          color: tokens.danger,
          border: '1px solid rgba(239, 68, 68, 0.3)',
          fontSize: fontSize.base,
        }}>
          Invalid or expired invitation link.
        </div>
      )}

      <form onSubmit={handleSignup}>
        <h3 style={{ color: tokens.textPrimary, fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>Sign Up</h3>

        {!inviteToken && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Organization Name</label>
            <input type="text" value={signupOrgName} onChange={(e) => setSignupOrgName(e.target.value)} required style={inputStyle} />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Email</label>
          <input type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} readOnly={!!inviteInfo} style={inputReadOnlyStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Password</label>
          <input type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} style={inputStyle} />
        </div>
        <button type="submit" disabled={signingUp} style={btnStyle}>
          {signingUp ? 'Signing up...' : 'Sign Up'}
        </button>
      </form>

      {!inviteToken && (
        <>
          <div style={{ borderTop: `1px solid ${tokens.borderDefault}`, margin: '24px 0' }} />
          <form onSubmit={handleLogin}>
            <h3 style={{ color: tokens.textPrimary, fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>Login</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Email</label>
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Password</label>
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} style={inputStyle} />
            </div>
            <button type="submit" disabled={loggingIn} style={btnStyle}>
              {loggingIn ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </>
      )}

      {inviteToken && (
        <p style={{ color: tokens.textDim, fontSize: fontSize.sm, marginTop: 20, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/" style={{ color: tokens.accentPrimary, textDecoration: 'none', fontWeight: 600 }}>Log in here</Link>
        </p>
      )}
    </div>
  );
};

export default Auth;
