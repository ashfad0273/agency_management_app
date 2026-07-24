import { useState } from 'react';
import RoleManagement from '../components/RoleManagement';
import { tokens, fontSize, radius } from '../theme/tokens';

type SettingsTab = 'roles' | 'organization' | 'api' | 'notifications';

interface TabDef {
  id: SettingsTab;
  label: string;
  icon: string;
}

const tabs: TabDef[] = [
  { id: 'roles', label: 'Roles & Permissions', icon: '🛡' },
  { id: 'organization', label: 'Organization Details', icon: '🏢' },
  { id: 'api', label: 'API & Webhooks', icon: '🔑' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
];

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      background: tokens.surfaceFloat,
      border: `1px solid ${tokens.borderDefault}`,
      borderRadius: radius.lg,
      padding: 32,
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 32, margin: '0 0 12px' }}>🚧</p>
      <h3 style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, margin: '0 0 8px' }}>{title}</h3>
      <p style={{ color: tokens.textDim, fontSize: fontSize.base, margin: 0 }}>{description}</p>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('roles');

  return (
    <div>
      <h2 style={{ color: tokens.textPrimary, fontSize: fontSize.lg, fontWeight: 600, margin: '0 0 20px' }}>Settings</h2>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: `1px solid ${tokens.borderDefault}`,
        marginBottom: 24,
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                background: 'transparent',
                color: isActive ? tokens.textPrimary : tokens.textSecondary,
                border: 'none',
                borderBottom: isActive ? `2px solid ${tokens.accentPrimary}` : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: isActive ? 600 : 400,
                fontSize: fontSize.md,
                marginBottom: -1,
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'roles' && <RoleManagement />}
      {activeTab === 'organization' && (
        <PlaceholderTab
          title="Organization Details"
          description="Manage your organization's name, branding, and preferences."
        />
      )}
      {activeTab === 'api' && (
        <PlaceholderTab
          title="API & Webhooks"
          description="Generate API keys and configure webhook endpoints for integrations."
        />
      )}
      {activeTab === 'notifications' && (
        <PlaceholderTab
          title="Notifications"
          description="Configure email, in-app, and push notification preferences."
        />
      )}
    </div>
  );
}
