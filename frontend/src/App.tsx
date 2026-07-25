import { useState, useEffect, CSSProperties } from 'react';
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
import InvitationsPage from './pages/InvitationsPage';
import DashboardPage from './pages/DashboardPage';
import OrganizationPage from './pages/OrganizationPage';
import { tokens, gridBackground } from './theme/tokens';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const processInviteToken = async (session: Session) => {
    const email = session.user.email;
    if (!email) return;

    const { data: pendingInvite } = await supabase
      .from('invitations')
      .select('token, organization_name')
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingInvite) {
      const { data: orgName, error } = await supabase.rpc('accept_invite_existing_user', {
        p_token: pendingInvite.token,
      });
      if (!error && orgName) {
        pushToast(`Welcome to ${orgName}!`, 'success');
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setAuthError(null);
      })
      .catch((err) => setAuthError(err instanceof Error ? err.message : 'Failed to restore session'));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setAuthError(null);

      // When user signs in via magic link, process pending invite from URL
      if (event === 'SIGNED_IN' && session) {
        processInviteToken(session);
      }
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
          <Auth onSuccess={(msg) => pushToast(msg, 'success')} />
        </div>
        {/* Toast notifications (rendered above the auth card) */}
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
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
          <Sidebar collapsed={!sidebarOpen} />
          <main style={{
            flex: 1,
            overflow: 'auto',
            padding: 24,
          }}>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/invitations" element={<InvitationsPage />} />
              <Route path="/organization" element={<OrganizationPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
        <StatusBar />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </div>
    </ErrorBoundary>
  );
}

const toastBase: CSSProperties = {
  minWidth: 260,
  maxWidth: 400,
  padding: '12px 16px',
  borderRadius: 6,
  marginBottom: 8,
  fontSize: 14,
  fontWeight: 600,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  animation: 'slide-in-right 0.2s ease-out',
};

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        return (
          <div
            key={t.id}
            style={{
              ...toastBase,
              background: isSuccess ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 68, 68, 0.95)',
              color: '#fff',
              border: `1px solid ${isSuccess ? tokens.success : tokens.danger}`,
            }}
          >
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => onDismiss(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1,
                padding: 0,
              }}
              aria-label="dismiss"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default App;
