// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './api/supabaseClient';
import Auth from './components/Auth';
import ProjectDashboard from './components/ProjectDashboard';
import ChatBox from './components/ChatBox';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState('projects'); // 'projects' or 'chat'
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => setSession(session))
      .catch((err) => setAuthError(err instanceof Error ? err.message : 'Failed to restore session'));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Agency Management App</h1>
      {authError && <p style={{ color: 'red' }}>Error: {authError}</p>}
      {!session ? (
        <Auth />
      ) : (
        <div>
          <button onClick={() => setView('projects')}>Projects</button>
          <button onClick={() => setView('chat')}>Global Chat</button>
          <button onClick={() => supabase.auth.signOut()} style={{ marginLeft: '10px' }}>Logout</button>
          <hr />

          {view === 'projects' ? (
            <ProjectDashboard />
          ) : (
            // This displays the Global Chat (passing null for projectId)
            <ChatBox projectId={null} />
          )}
        </div>
      )}
    </div>
  );
}
export default App;