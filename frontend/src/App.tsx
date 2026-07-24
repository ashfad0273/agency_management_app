import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './api/supabaseClient';
import Auth from './components/Auth';
import ErrorBoundary from './components/ErrorBoundary';
import GlobalHeader from './components/GlobalHeader';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import ProjectsPage from './pages/ProjectsPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import { tokens, gridBackground } from './theme/tokens';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setAuthError(null);
      })
      .catch((err) => setAuthError(err instanceof Error ? err.message : 'Failed to restore session'));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthError(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return (
      <div style={{ ...gridBackground, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          background: tokens.surfaceFloat,
          border: `1px solid ${tokens.borderDefault}`,
          borderRadius: 8,
          padding: 32,
          maxWidth: 420,
          width: '100%',
          margin: 20,
          animation: 'slide-down 0.2s ease-out',
        }}>
          <h1 style={{
            color: tokens.textPrimary,
            fontSize: 24,
            fontWeight: 700,
            margin: '0 0 4px',
          }}>
            Agency Management
          </h1>
          <p style={{ color: tokens.textDim, fontSize: 13, margin: '0 0 20px' }}>
            Sign in to your organization workspace
          </p>
          {authError && (
            <div style={{
              padding: '8px 12px',
              marginBottom: 16,
              borderRadius: 4,
              background: 'rgba(239, 68, 68, 0.1)',
              color: tokens.danger,
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: 13,
            }}>
              {authError}
            </div>
          )}
          <Auth />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{ ...gridBackground, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <GlobalHeader
          userEmail={session.user.email}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {sidebarOpen && <Sidebar />}
          <main style={{
            flex: 1,
            overflow: 'auto',
            padding: 24,
            marginLeft: sidebarOpen ? 0 : 0,
            transition: 'margin-left 0.2s ease',
          }}>
            <Routes>
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/projects" replace />} />
            </Routes>
          </main>
        </div>
        <StatusBar />
      </div>
    </ErrorBoundary>
  );
}

export default App;
