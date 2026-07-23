import { useState } from 'react';
import RoleManagement from '../components/RoleManagement';

type SettingsTab = 'roles';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('roles');

  return (
    <div style={{ padding: '20px' }}>
      <h2>Settings</h2>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid #ddd',
        marginBottom: '20px',
        paddingBottom: '0',
      }}>
        <button
          onClick={() => setActiveTab('roles')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'roles' ? '#4a90d9' : 'transparent',
            color: activeTab === 'roles' ? 'white' : '#555',
            border: 'none',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
            fontWeight: activeTab === 'roles' ? 'bold' : 'normal',
            fontSize: '0.95em',
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