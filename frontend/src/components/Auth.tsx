// frontend/src/components/Auth.tsx
import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';

const Auth = () => {
  // Separate states for Signup and Login
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupOrgName, setSignupOrgName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [error, setError] = useState('');

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: {
          organization_name: signupOrgName,
        },
      },
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
    else alert('Login successful!');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Agency Management App</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Signup Form */}
      <form onSubmit={handleSignup}>
        <h3>Sign Up</h3>
        <label>Organization Name: <input type="text" value={signupOrgName} onChange={(e) => setSignupOrgName(e.target.value)} required /></label><br/>
        <label>Email: <input type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} /></label><br/>
        <label>Password: <input type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} /></label><br/>
        <button type="submit">Sign Up</button>
      </form>

      <hr />

      {/* Login Form */}
      <form onSubmit={handleLogin}>
        <h3>Login</h3>
        <label>Email: <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} /></label><br/>
        <label>Password: <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} /></label><br/>
        <button type="submit">Login</button>
      </form>
    </div>
  );
};

export default Auth;