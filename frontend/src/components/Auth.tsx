import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';

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

  // If there's an invite token, fetch invite info on mount
  React.useEffect(() => {
    if (inviteToken) {
      supabase
        .rpc('get_invite_by_token', { p_token: inviteToken })
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            const row = data[0] as { organization_name: string; email: string };
            setInviteInfo({ org_name: row.organization_name });
            // Pre-fill the email so the invited user knows which account was invited
            setSignupEmail(row.email);
          }
        });
    }
  }, [inviteToken]);

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();

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
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) setError(error.message);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px' }}>
      <h2>Agency Management App</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {inviteToken && inviteInfo && (
        <p style={{ color: '#4a90d9', fontWeight: 'bold' }}>
          You've been invited to join <strong>{inviteInfo.org_name}</strong>
        </p>
      )}

      {inviteToken && !inviteInfo && (
        <p style={{ color: '#888' }}>Verifying invitation...</p>
      )}

      {/* ======== Signup Form ======== */}
      <form onSubmit={handleSignup}>
        <h3>Sign Up</h3>

        {!inviteToken && (
          <>
            <label>
              Organization Name:{' '}
              <input type="text" value={signupOrgName} onChange={(e) => setSignupOrgName(e.target.value)} required />
            </label>
            <br />
          </>
        )}

        <label>
          Email:{' '}
          <input
            type="email"
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
            readOnly={!!inviteInfo}
            style={inviteInfo ? { background: '#f0f0f0', cursor: 'not-allowed' } : {}}
          />
        </label>
        <br />
        <label>
          Password:{' '}
          <input type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
        </label>
        <br />
        <button type="submit">Sign Up</button>
      </form>

      {/* ======== Login Form (hidden when following an invite link) ======== */}
      {!inviteToken && (
        <>
          <hr />
          <form onSubmit={handleLogin}>
            <h3>Login</h3>
            <label>
              Email:{' '}
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            </label>
            <br />
            <label>
              Password:{' '}
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            </label>
            <br />
            <button type="submit">Login</button>
          </form>
        </>
      )}

      {/* When following an invite link, show a small link to login for existing users */}
      {inviteToken && (
        <p style={{ fontSize: '0.85em', color: '#888', marginTop: '20px' }}>
          Already have an account? <a href="/" style={{ color: '#4a90d9' }}>Log in here</a>
        </p>
      )}
    </div>
  );
};

export default Auth;