import { useState } from 'react';
import RoleManagement from '../components/RoleManagement';
import { tokens, fontSize } from '../theme/tokens';

type SettingsTab = 'roles';

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
        <button
          onClick={() => setActiveTab('roles')}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            color: activeTab === 'roles' ? tokens.accentPrimary : tokens.textSecondary,
            border: 'none',
            borderBottom: activeTab === 'roles' ? `2px solid ${tokens.accentPrimary}` : '2px solid transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'roles' ? 600 : 400,
            fontSize: fontSize.md,
            marginBottom: -1,
            transition: 'all 0.15s ease',
          }}
        >
          Roles & Permissions
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'roles' && <RoleManagement />}
    </div>
  );
}
