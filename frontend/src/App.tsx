// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { supabase } from './api/supabaseClient';
import Auth from './components/Auth';
import ErrorBoundary from './components/ErrorBoundary';
import ProjectsPage from './pages/ProjectsPage';
import ChatPage from './pages/ChatPage';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => setSession(session))
      .catch((err) => setAuthError(err instanceof Error ? err.message : 'Failed to restore session'));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // If not logged in, show the auth screen (routes are still mounted but not visible)
  if (!session) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Agency Management App</h1>
        {authError && <p style={{ color: 'red' }}>Error: {authError}</p>}
        <Auth />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Agency Management App</h1>
      {authError && <p style={{ color: 'red' }}>Error: {authError}</p>}

      <nav>
        <Link
          to="/projects"
          style={{
            marginRight: '5px',
            fontWeight: location.pathname.startsWith('/projects') ? 'bold' : 'normal',
          }}
        >
          Projects
        </Link>
        <Link
          to="/chat"
          style={{
            marginRight: '10px',
            fontWeight: location.pathname.startsWith('/chat') ? 'bold' : 'normal',
          }}
        >
          Chat
        </Link>
        <button onClick={() => supabase.auth.signOut()}>Logout</button>
      </nav>
      <hr />

      <ErrorBoundary>
        <Routes>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}
export default App;