import { useState, useEffect, FormEvent } from 'react';
import ChatBox from './ChatBox';
import { ChannelService, ChannelWithMembership } from '../services/ChannelService';
import { ConversationService, ConversationWithUser } from '../services/ConversationService';
import { ProjectMemberService } from '../services/ProjectMemberService';
import { Project } from '../services/ProjectService';
import { ChatService } from '../services/ChatService';

type ActiveChat =
  | { type: 'channel'; channelId: string; channelName: string }
  | { type: 'project'; projectId: string; projectName: string }
  | { type: 'dm'; conversationId: string; otherUserName: string };

export default function ChatLayout() {
  const [activeChat, setActiveChat] = useState<ActiveChat>(() => ({
    type: 'channel',
    channelId: '',
    channelName: '#general',
  }));
  const [channels, setChannels] = useState<ChannelWithMembership[]>([]);
  const [conversations, setConversations] = useState<ConversationWithUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [dmSearchResults, setDmSearchResults] = useState<{ id: string; email: string; display: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const activeChannelId = activeChat.type === 'channel' ? activeChat.channelId : undefined;
  const activeProjectId = activeChat.type === 'project' ? activeChat.projectId : undefined;
  const activeConversationId = activeChat.type === 'dm' ? activeChat.conversationId : undefined;
  const isActiveChannel = activeChat.type === 'channel';

  useEffect(() => {
    loadData();
  }, []);

  // Auto-select the #general channel once loaded
  useEffect(() => {
    if (channels.length > 0 && isActiveChannel && !activeChannelId) {
      const general = channels.find(c => c.name === 'general');
      if (general) {
        setActiveChat({ type: 'channel', channelId: general.id, channelName: '#general' });
        ChatService.markAsRead(undefined, general.id);
      } else if (channels.length > 0) {
        setActiveChat({ type: 'channel', channelId: channels[0].id, channelName: `#${channels[0].name}` });
        ChatService.markAsRead(undefined, channels[0].id);
      }
    }
  }, [channels, isActiveChannel, activeChannelId]);

  // Join public channel when user clicks it
  useEffect(() => {
    if (isActiveChannel && activeChannelId) {
      const channel = channels.find(c => c.id === activeChannelId);
      if (channel && !channel.is_member && !channel.is_private) {
        ChannelService.joinChannel(channel.id).then(() => loadData());
      }
    }
  }, [isActiveChannel, activeChannelId]);

  // Search for users when typing in the DM search
  useEffect(() => {
    if (!dmSearchQuery.trim()) {
      setDmSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await ConversationService.searchUsers(dmSearchQuery.trim());
        setDmSearchResults(results);
      } catch {
        setDmSearchResults([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [dmSearchQuery]);

  // Fetch unread counts periodically
  useEffect(() => {
    const fetchUnreads = async () => {
      try {
        const counts: Record<string, number> = {};

        for (const c of channels) {
          if (!c.is_member) continue;
          try {
            const count = await ChatService.getUnreadCount(undefined, c.id);
            if (count > 0) counts['ch:' + c.id] = count;
          } catch { /* skip */ }
        }

        for (const dm of conversations) {
          try {
            const count = await ChatService.getUnreadCount(undefined, undefined, dm.conversation_id);
            if (count > 0) counts['dm:' + dm.conversation_id] = count;
          } catch { /* skip */ }
        }

        for (const p of projects) {
          try {
            const count = await ChatService.getUnreadCount(p.id);
            if (count > 0) counts[p.id] = count;
          } catch { /* skip */ }
        }

        setUnreadCounts(counts);
      } catch {
        // Silently ignore
      }
    };

    fetchUnreads();
    const interval = setInterval(fetchUnreads, 15000);
    return () => clearInterval(interval);
  }, [channels, conversations, projects]);

  const loadData = async () => {
    try {
      const [channelData, conversationData, projectData] = await Promise.all([
        ChannelService.getChannelsWithMembership(),
        ConversationService.getConversations(),
        ProjectMemberService.getUserProjects(),
      ]);
      setChannels(channelData);
      setConversations(conversationData);
      setProjects(projectData);
    } catch (error) {
      console.error('Error loading chat data:', error);
    }
  };

  const handleSelectChannel = (ch: ChannelWithMembership) => {
    setActiveChat({ type: 'channel', channelId: ch.id, channelName: `#${ch.name}` });
    ChatService.markAsRead(undefined, ch.id);
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next['ch:' + ch.id];
      return next;
    });
  };

  const handleSelectDm = (dm: ConversationWithUser) => {
    setActiveChat({ type: 'dm', conversationId: dm.conversation_id, otherUserName: dm.other_user_display });
    ChatService.markAsRead(undefined, undefined, dm.conversation_id);
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next['dm:' + dm.conversation_id];
      return next;
    });
    setShowNewDm(false);
  };

  const handleSelectProject = (project: Project) => {
    setActiveChat({ type: 'project', projectId: project.id, projectName: project.name });
    ChatService.markAsRead(project.id);
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
  };

  const handleCreateChannel = async (e: FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      const channel = await ChannelService.createChannel(
        newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        newChannelDesc.trim(),
        newChannelPrivate,
      );
      setNewChannelName('');
      setNewChannelDesc('');
      setNewChannelPrivate(false);
      setShowCreateChannel(false);
      await loadData();
      setActiveChat({ type: 'channel', channelId: channel.id, channelName: `#${channel.name}` });
    } catch (error) {
      console.error('Error creating channel:', error);
      alert('Error creating channel: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleStartDm = async (otherUserId: string) => {
    try {
      const conversationId = await ConversationService.createOrGetConversation(otherUserId);
      await loadData();
      const dm = (await ConversationService.getConversations()).find(d => d.conversation_id === conversationId);
      if (dm) {
        handleSelectDm(dm);
      }
      setDmSearchQuery('');
      setDmSearchResults([]);
    } catch (error) {
      console.error('Error starting DM:', error);
    }
  };

  const activeTitle = activeChat.type === 'channel'
    ? activeChat.channelName
    : activeChat.type === 'dm'
    ? activeChat.otherUserName
    : activeChat.projectName;

  return (
    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
      {/* Sidebar */}
      <div style={{
        width: '240px',
        minWidth: '240px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '10px',
        background: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column' as const,
        maxHeight: '600px',
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95em', color: '#555' }}>Chats</h4>

        {/* ======== Channels Section ======== */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}>
            <h5 style={{ margin: 0, fontSize: '0.8em', color: '#888', letterSpacing: '0.5px' }}>CHANNELS</h5>
            <button
              onClick={() => setShowCreateChannel(!showCreateChannel)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#4a90d9',
                fontSize: '1.2em',
                fontWeight: 'bold',
                padding: '0 4px',
                lineHeight: '1',
              }}
              title="Create Channel"
            >
              +
            </button>
          </div>

          {showCreateChannel && (
            <form onSubmit={handleCreateChannel} style={{
              marginBottom: '8px',
              padding: '8px',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}>
              <input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="channel-name" required style={{ width: '100%', boxSizing: 'border-box', marginBottom: '4px', fontSize: '0.85em', padding: '4px 6px' }} />
              <input value={newChannelDesc} onChange={(e) => setNewChannelDesc(e.target.value)} placeholder="Description (optional)" style={{ width: '100%', boxSizing: 'border-box', marginBottom: '4px', fontSize: '0.85em', padding: '4px 6px' }} />
              <label style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <input type="checkbox" checked={newChannelPrivate} onChange={(e) => setNewChannelPrivate(e.target.checked)} />
                Private channel
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="submit" style={{ fontSize: '0.8em', padding: '3px 8px' }}>Create</button>
                <button type="button" onClick={() => setShowCreateChannel(false)} style={{ fontSize: '0.8em', padding: '3px 8px' }}>Cancel</button>
              </div>
            </form>
          )}

          <div style={{ maxHeight: '150px', overflowY: 'auto' as const }}>
            {channels.map((ch) => (
              <div
                key={ch.id}
                onClick={() => handleSelectChannel(ch)}
                style={{
                  padding: '6px 10px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  background: activeChat.type === 'channel' && activeChat.channelId === ch.id ? '#4a90d9' : 'transparent',
                  color: activeChat.type === 'channel' && activeChat.channelId === ch.id ? 'white' : 'inherit',
                  marginBottom: '2px',
                  position: 'relative',
                  fontWeight: activeChat.type === 'channel' && activeChat.channelId === ch.id ? 'bold' : 'normal',
                  fontSize: '0.9em',
                  transition: 'background 0.15s',
                  opacity: ch.is_member ? 1 : 0.6,
                }}
                onMouseEnter={(e) => {
                  if (!(activeChat.type === 'channel' && activeChat.channelId === ch.id)) e.currentTarget.style.background = '#e0e0e0';
                }}
                onMouseLeave={(e) => {
                  if (!(activeChat.type === 'channel' && activeChat.channelId === ch.id)) e.currentTarget.style.background = 'transparent';
                }}
              >
                # {ch.name}
                {ch.is_private && <span style={{ fontSize: '0.7em', marginLeft: '4px' }}>🔒</span>}
                {unreadCounts['ch:' + ch.id] && (
                  <span style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'red', color: 'white', borderRadius: '50%', padding: '2px 6px',
                    fontSize: '0.7em', fontWeight: 'bold', lineHeight: '1',
                  }}>
                    {unreadCounts['ch:' + ch.id] > 99 ? '99+' : unreadCounts['ch:' + ch.id]}
                  </span>
                )}
              </div>
            ))}
            {channels.length === 0 && <p style={{ fontSize: '0.8em', color: '#aaa', margin: '5px 0' }}>No channels yet</p>}
          </div>
        </div>

        {/* Divider */}
        <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #ddd' }} />

        {/* ======== Direct Messages Section ======== */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}>
            <h5 style={{ margin: 0, fontSize: '0.8em', color: '#888', letterSpacing: '0.5px' }}>DIRECT MESSAGES</h5>
            <button
              onClick={() => setShowNewDm(!showNewDm)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#4a90d9',
                fontSize: '1.2em',
                fontWeight: 'bold',
                padding: '0 4px',
                lineHeight: '1',
              }}
              title="New Direct Message"
            >
              +
            </button>
          </div>

          {/* New DM Search */}
          {showNewDm && (
            <div style={{
              marginBottom: '8px',
              padding: '8px',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}>
              <input
                value={dmSearchQuery}
                onChange={(e) => setDmSearchQuery(e.target.value)}
                placeholder="Search by email..."
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.85em', padding: '4px 6px' }}
              />
              {searching && <p style={{ fontSize: '0.75em', color: '#aaa', margin: '4px 0 0' }}>Searching...</p>}
              {dmSearchResults.length > 0 && (
                <div style={{ marginTop: '6px' }}>
                  {dmSearchResults.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => handleStartDm(r.id)}
                      style={{
                        padding: '6px 8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        fontSize: '0.85em',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#e0e0e0'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {r.display} <span style={{ color: '#888', fontSize: '0.9em' }}>({r.email})</span>
                    </div>
                  ))}
                </div>
              )}
              {dmSearchQuery && !searching && dmSearchResults.length === 0 && (
                <p style={{ fontSize: '0.75em', color: '#aaa', margin: '4px 0 0' }}>No users found</p>
              )}
            </div>
          )}

          <div style={{ maxHeight: '120px', overflowY: 'auto' as const }}>
            {conversations.map((dm) => (
              <div
                key={dm.conversation_id}
                onClick={() => handleSelectDm(dm)}
                style={{
                  padding: '6px 10px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  background: activeChat.type === 'dm' && activeChat.conversationId === dm.conversation_id ? '#4a90d9' : 'transparent',
                  color: activeChat.type === 'dm' && activeChat.conversationId === dm.conversation_id ? 'white' : 'inherit',
                  marginBottom: '2px',
                  position: 'relative',
                  fontWeight: activeChat.type === 'dm' && activeChat.conversationId === dm.conversation_id ? 'bold' : 'normal',
                  fontSize: '0.9em',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!(activeChat.type === 'dm' && activeChat.conversationId === dm.conversation_id)) e.currentTarget.style.background = '#e0e0e0';
                }}
                onMouseLeave={(e) => {
                  if (!(activeChat.type === 'dm' && activeChat.conversationId === dm.conversation_id)) e.currentTarget.style.background = 'transparent';
                }}
              >
                {dm.other_user_display}
                {unreadCounts['dm:' + dm.conversation_id] && (
                  <span style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'red', color: 'white', borderRadius: '50%', padding: '2px 6px',
                    fontSize: '0.7em', fontWeight: 'bold', lineHeight: '1',
                  }}>
                    {unreadCounts['dm:' + dm.conversation_id] > 99 ? '99+' : unreadCounts['dm:' + dm.conversation_id]}
                  </span>
                )}
              </div>
            ))}
            {conversations.length === 0 && !showNewDm && (
              <p style={{ fontSize: '0.8em', color: '#aaa', margin: '5px 0' }}>No conversations yet</p>
            )}
          </div>
        </div>

        {/* Divider */}
        <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #ddd' }} />

        {/* ======== Project Chats Section ======== */}
        <div style={{ flex: 1, overflowY: 'auto' as const, marginTop: '6px' }}>
          <h5 style={{ margin: '0 0 6px 0', fontSize: '0.8em', color: '#888', letterSpacing: '0.5px' }}>PROJECTS</h5>
          {projects.length === 0 && <p style={{ fontSize: '0.8em', color: '#aaa', margin: '5px 0' }}>No projects yet</p>}
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => handleSelectProject(p)}
              style={{
                padding: '6px 10px',
                cursor: 'pointer',
                borderRadius: '4px',
                background: activeChat.type === 'project' && activeChat.projectId === p.id ? '#4a90d9' : 'transparent',
                color: activeChat.type === 'project' && activeChat.projectId === p.id ? 'white' : 'inherit',
                marginBottom: '2px',
                position: 'relative',
                fontWeight: activeChat.type === 'project' && activeChat.projectId === p.id ? 'bold' : 'normal',
                fontSize: '0.9em',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!(activeChat.type === 'project' && activeChat.projectId === p.id)) e.currentTarget.style.background = '#e0e0e0';
              }}
              onMouseLeave={(e) => {
                if (!(activeChat.type === 'project' && activeChat.projectId === p.id)) e.currentTarget.style.background = 'transparent';
              }}
            >
              {p.name}
              {unreadCounts[p.id] && (
                <span style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'red', color: 'white', borderRadius: '50%', padding: '2px 6px',
                  fontSize: '0.7em', fontWeight: 'bold', lineHeight: '1',
                }}>
                  {unreadCounts[p.id] > 99 ? '99+' : unreadCounts[p.id]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <ChatBox
          projectId={activeProjectId}
          channelId={activeChannelId}
          conversationId={activeConversationId}
          title={activeTitle}
        />
      </div>
    </div>
  );
}