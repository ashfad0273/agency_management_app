import { useState, useEffect, useRef, FormEvent } from 'react';
import ChatBox from './ChatBox';
import { ChannelService, ChannelWithMembership } from '../services/ChannelService';
import { ConversationService, ConversationWithUser } from '../services/ConversationService';
import { ProjectMemberService } from '../services/ProjectMemberService';
import { Project } from '../services/ProjectService';
import { ChatService } from '../services/ChatService';
import { InviteService } from '../services/InviteService';
import { usePermission, Permissions } from '../hooks/usePermission';
import { tokens, sharedStyles, radius, fontSize } from '../theme/tokens';

type ActiveChat =
  | { type: 'channel'; channelId: string; channelName: string }
  | { type: 'project'; projectId: string; projectName: string }
  | { type: 'dm'; conversationId: string; otherUserName: string };

export default function ChatLayout() {
  const { can } = usePermission();
  const canManageChannels = can(Permissions.Chat.ManageChannels);
  const canInviteUsers = can(Permissions.User.Invite);

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
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error'; message: string } | null>(null);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const inviteTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showFeedback = (type: 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  useEffect(() => {
    return () => { if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current); };
  }, []);

  const activeChannelId = activeChat.type === 'channel' ? (activeChat.channelId || undefined) : undefined;
  const activeProjectId = activeChat.type === 'project' ? activeChat.projectId : undefined;
  const activeConversationId = activeChat.type === 'dm' ? activeChat.conversationId : undefined;
  const isActiveChannel = activeChat.type === 'channel';

  useEffect(() => {
    loadData();
  }, []);

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

  useEffect(() => {
    if (isActiveChannel && activeChannelId) {
      const channel = channels.find(c => c.id === activeChannelId);
      if (channel && !channel.is_member && !channel.is_private) {
        ChannelService.joinChannel(channel.id).then(() => loadData());
      }
    }
  }, [isActiveChannel, activeChannelId]);

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

  useEffect(() => {
    let ignore = false;

    const fetchUnreads = async () => {
      try {
        const counts: Record<string, number> = {};
        for (const c of channels) {
          if (!c.is_member) continue;
          try { const count = await ChatService.getUnreadCount(undefined, c.id); if (count > 0) counts['ch:' + c.id] = count; } catch {}
        }
        for (const dm of conversations) {
          try { const count = await ChatService.getUnreadCount(undefined, undefined, dm.conversation_id); if (count > 0) counts['dm:' + dm.conversation_id] = count; } catch {}
        }
        for (const p of projects) {
          try { const count = await ChatService.getUnreadCount(p.id); if (count > 0) counts[p.id] = count; } catch {}
        }
        if (!ignore) setUnreadCounts(counts);
      } catch {}
    };

    fetchUnreads();
    const interval = setInterval(fetchUnreads, 15000);
    return () => { ignore = true; clearInterval(interval); };
  }, [channels, conversations, projects]);

  const loadData = async () => {
    try {
      const [channelData, conversationData, projectData] = await Promise.all([
        ChannelService.getChannelsWithMembership().catch(() => undefined),
        ConversationService.getConversations().catch(() => undefined),
        ProjectMemberService.getUserProjects().catch(() => undefined),
      ]);
      if (channelData !== undefined) setChannels(channelData);
      if (conversationData !== undefined) setConversations(conversationData);
      if (projectData !== undefined) setProjects(projectData);
    } catch (error) {
      console.error('Error loading chat data:', error);
    }
  };

  const handleSelectChannel = (ch: ChannelWithMembership) => {
    setActiveChat({ type: 'channel', channelId: ch.id, channelName: `#${ch.name}` });
    ChatService.markAsRead(undefined, ch.id);
    setUnreadCounts((prev) => { const next = { ...prev }; delete next['ch:' + ch.id]; return next; });
  };

  const handleSelectDm = (dm: ConversationWithUser) => {
    setActiveChat({ type: 'dm', conversationId: dm.conversation_id, otherUserName: dm.other_user_display });
    ChatService.markAsRead(undefined, undefined, dm.conversation_id);
    setUnreadCounts((prev) => { const next = { ...prev }; delete next['dm:' + dm.conversation_id]; return next; });
    setShowNewDm(false);
  };

  const handleSelectProject = (project: Project) => {
    setActiveChat({ type: 'project', projectId: project.id, projectName: project.name });
    ChatService.markAsRead(project.id);
    setUnreadCounts((prev) => { const next = { ...prev }; delete next[project.id]; return next; });
  };

  const handleCreateChannel = async (e: FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    setCreatingChannel(true);
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
      showFeedback('error', 'Error creating channel: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
    setCreatingChannel(false);
  };

  const handleStartDm = async (otherUserId: string) => {
    try {
      const conversationId = await ConversationService.createOrGetConversation(otherUserId);
      await loadData();
      const dm = (await ConversationService.getConversations()).find(d => d.conversation_id === conversationId);
      if (dm) handleSelectDm(dm);
      setDmSearchQuery('');
      setDmSearchResults([]);
    } catch (error) {
      console.error('Error starting DM:', error);
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteSending(true);
    setInviteLink('');
    setInviteEmailSent(false);
    try {
      const result = await InviteService.createInvitation(inviteEmail.trim());
      setInviteLink(result.link);
      setInviteEmailSent(result.emailSent);
      if (result.emailSent) setInviteEmail('');
    } catch (error) {
      console.error('Error creating invitation:', error);
      showFeedback('error', 'Error creating invitation: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
    setInviteSending(false);
  };

  const activeTitle = activeChat.type === 'channel'
    ? activeChat.channelName
    : activeChat.type === 'dm'
    ? activeChat.otherUserName
    : activeChat.projectName;

  const sidebarItemStyle = (isActive: boolean, _hoverKey: string | null, itemKey: string) => ({
    padding: '7px 12px 7px 12px',
    cursor: 'pointer',
    borderRadius: radius.sm,
    background: isActive ? tokens.surfaceHover : hoveredItem === itemKey ? tokens.surfaceHover : 'transparent',
    color: isActive ? tokens.textPrimary : tokens.textSecondary,
    marginBottom: 2,
    position: 'relative' as const,
    fontWeight: isActive ? 600 : 400,
    fontSize: fontSize.base,
    transition: 'all 0.15s ease',
    borderLeft: isActive ? `2px solid ${tokens.accentPrimary}` : '2px solid transparent',
    paddingLeft: isActive ? 10 : 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  });

  const sectionHeaderStyle = {
    ...sharedStyles.label,
    margin: 0,
    padding: 0,
  };

  const plusButtonStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: tokens.accentPrimary,
    fontSize: 16,
    fontWeight: 600,
    padding: '0 4px',
    lineHeight: 1 as const,
  };

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%' }}>
      {/* Sidebar */}
      <div style={{
        width: 240,
        minWidth: 240,
        borderRight: `1px solid ${tokens.borderDefault}`,
        background: tokens.surfaceInset,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '100%',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${tokens.borderDefault}` }}>
          <h4 style={{ margin: 0, fontSize: fontSize.md, fontWeight: 600, color: tokens.textPrimary }}>Chats</h4>
        </div>

        {feedback && (
          <div style={{
            ...sharedStyles.feedbackBanner('error'),
            margin: '8px 10px 0',
            padding: '6px 10px',
            fontSize: fontSize.sm,
          }}>
            {feedback.message}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {/* Invite Section */}
          {canInviteUsers && (
            <div style={{ marginBottom: 10 }}>
              <button
                onClick={() => { setShowInvite(prev => !prev); setInviteLink(''); }}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: fontSize.sm,
                  background: showInvite ? tokens.surfaceHover : tokens.accentPrimary,
                  color: showInvite ? tokens.textSecondary : '#fff',
                  border: 'none',
                  borderRadius: radius.sm,
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
              >
                {showInvite ? 'Cancel' : '+ Invite People'}
              </button>

              {showInvite && (
                <form onSubmit={handleInvite} style={{
                  marginTop: 8,
                  padding: 10,
                  background: tokens.surfaceFloat,
                  border: `1px solid ${tokens.borderDefault}`,
                  borderRadius: radius.sm,
                }}>
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    type="email"
                    required
                    style={{ ...sharedStyles.input, marginBottom: 6, fontSize: fontSize.sm }}
                  />
                  <button type="submit" disabled={inviteSending} style={{
                    ...sharedStyles.btnPrimary,
                    width: '100%',
                    fontSize: fontSize.sm,
                    padding: '6px 10px',
                    opacity: inviteSending ? 0.6 : 1,
                  }}>
                    {inviteSending ? 'Creating...' : 'Send Invite'}
                  </button>

                  {inviteEmailSent && (
                    <p style={{ margin: '6px 0 0', fontSize: fontSize.xs, color: tokens.accentPrimary }}>
                      ✓ Invitation email sent to {inviteEmail}!
                    </p>
                  )}

                  {inviteLink && !inviteEmailSent && (
                    <div style={{ marginTop: 8, fontSize: fontSize.xs }}>
                      <p style={{ margin: '0 0 4px', color: tokens.textDim }}>Share this link:</p>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          readOnly
                          value={inviteLink}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          style={{ ...sharedStyles.input, flex: 1, fontSize: fontSize.xs, padding: '4px 6px' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(inviteLink);
                            setInviteCopied(true);
                            if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
                            inviteTimerRef.current = setTimeout(() => setInviteCopied(false), 2000);
                          }}
                          style={{
                            padding: '4px 8px',
                            fontSize: fontSize.xs,
                            background: tokens.accentPrimary,
                            color: '#fff',
                            border: 'none',
                            borderRadius: radius.sm,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {inviteCopied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </div>
          )}

          {/* Channels */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h5 style={sectionHeaderStyle}>CHANNELS</h5>
              {canManageChannels && (
                <button onClick={() => setShowCreateChannel(!showCreateChannel)} style={plusButtonStyle} title="Create Channel">+</button>
              )}
            </div>

            {showCreateChannel && (
              <form onSubmit={handleCreateChannel} style={{
                marginBottom: 8,
                padding: 10,
                background: tokens.surfaceFloat,
                border: `1px solid ${tokens.borderDefault}`,
                borderRadius: radius.sm,
              }}>
                <input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="channel-name" required style={{ ...sharedStyles.input, marginBottom: 4, fontSize: fontSize.sm }} />
                <input value={newChannelDesc} onChange={(e) => setNewChannelDesc(e.target.value)} placeholder="Description (optional)" style={{ ...sharedStyles.input, marginBottom: 4, fontSize: fontSize.sm }} />
                <label style={{ fontSize: fontSize.xs, display: 'flex', alignItems: 'center', gap: 4, color: tokens.textSecondary, marginBottom: 6 }}>
                  <input type="checkbox" checked={newChannelPrivate} onChange={(e) => setNewChannelPrivate(e.target.checked)} />
                  Private channel
                </label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="submit" disabled={creatingChannel} style={{ ...sharedStyles.btnPrimary, fontSize: fontSize.sm, padding: '4px 8px', opacity: creatingChannel ? 0.6 : 1 }}>
                    {creatingChannel ? 'Creating...' : 'Create'}
                  </button>
                  <button type="button" onClick={() => setShowCreateChannel(false)} style={{ ...sharedStyles.btnGhost, fontSize: fontSize.sm, padding: '4px 8px' }}>Cancel</button>
                </div>
              </form>
            )}

            <div style={{ maxHeight: 150, overflowY: 'auto' }}>
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  onClick={() => handleSelectChannel(ch)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectChannel(ch); } }}
                  role="button"
                  tabIndex={0}
                  style={sidebarItemStyle(
                    activeChat.type === 'channel' && activeChat.channelId === ch.id,
                    hoveredItem,
                    'ch:' + ch.id,
                  )}
                  onMouseEnter={() => setHoveredItem('ch:' + ch.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <span style={{ opacity: ch.is_member ? 1 : 0.6 }}>
                    # {ch.name}
                    {ch.is_private && <span style={{ fontSize: fontSize.xs, marginLeft: 4 }}>🔒</span>}
                  </span>
                  {unreadCounts['ch:' + ch.id] && (
                    <span style={sharedStyles.unreadBadge}>
                      {unreadCounts['ch:' + ch.id] > 99 ? '99+' : unreadCounts['ch:' + ch.id]}
                    </span>
                  )}
                </div>
              ))}
              {channels.length === 0 && <p style={{ ...sharedStyles.textMuted, margin: '5px 0' }}>No channels yet</p>}
            </div>
          </div>

          <hr style={sharedStyles.divider} />

          {/* Direct Messages */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h5 style={sectionHeaderStyle}>DIRECT MESSAGES</h5>
              <button onClick={() => setShowNewDm(!showNewDm)} style={plusButtonStyle} title="New Direct Message">+</button>
            </div>

            {showNewDm && (
              <div style={{
                marginBottom: 8,
                padding: 10,
                background: tokens.surfaceFloat,
                border: `1px solid ${tokens.borderDefault}`,
                borderRadius: radius.sm,
              }}>
                <input
                  value={dmSearchQuery}
                  onChange={(e) => setDmSearchQuery(e.target.value)}
                  placeholder="Search by email..."
                  autoFocus
                  style={{ ...sharedStyles.input, fontSize: fontSize.sm }}
                />
                {searching && <p style={{ ...sharedStyles.textMuted, margin: '4px 0 0' }}>Searching...</p>}
                {dmSearchResults.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {dmSearchResults.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => handleStartDm(r.id)}
                        style={{
                          padding: '6px 8px',
                          cursor: 'pointer',
                          borderRadius: radius.sm,
                          fontSize: fontSize.sm,
                          color: tokens.textSecondary,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = tokens.surfaceHover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        {r.display} <span style={{ color: tokens.textDim, fontSize: fontSize.xs }}>({r.email})</span>
                      </div>
                    ))}
                  </div>
                )}
                {dmSearchQuery && !searching && dmSearchResults.length === 0 && (
                  <p style={{ ...sharedStyles.textMuted, margin: '4px 0 0' }}>No users found</p>
                )}
              </div>
            )}

            <div style={{ maxHeight: 120, overflowY: 'auto' }}>
              {conversations.map((dm) => (
                <div
                  key={dm.conversation_id}
                  onClick={() => handleSelectDm(dm)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectDm(dm); } }}
                  role="button"
                  tabIndex={0}
                  style={sidebarItemStyle(
                    activeChat.type === 'dm' && activeChat.conversationId === dm.conversation_id,
                    hoveredItem,
                    'dm:' + dm.conversation_id,
                  )}
                  onMouseEnter={() => setHoveredItem('dm:' + dm.conversation_id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <span>{dm.other_user_display}</span>
                  {unreadCounts['dm:' + dm.conversation_id] && (
                    <span style={sharedStyles.unreadBadge}>
                      {unreadCounts['dm:' + dm.conversation_id] > 99 ? '99+' : unreadCounts['dm:' + dm.conversation_id]}
                    </span>
                  )}
                </div>
              ))}
              {conversations.length === 0 && !showNewDm && (
                <p style={{ ...sharedStyles.textMuted, margin: '5px 0' }}>No conversations yet</p>
              )}
            </div>
          </div>

          <hr style={sharedStyles.divider} />

          {/* Project Chats */}
          <div style={{ flex: 1, overflowY: 'auto', marginTop: 6 }}>
            <h5 style={sectionHeaderStyle}>PROJECTS</h5>
            {projects.length === 0 && <p style={{ ...sharedStyles.textMuted, margin: '5px 0' }}>No projects yet</p>}
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelectProject(p)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectProject(p); } }}
                role="button"
                tabIndex={0}
                style={sidebarItemStyle(
                  activeChat.type === 'project' && activeChat.projectId === p.id,
                  hoveredItem,
                  'proj:' + p.id,
                )}
                onMouseEnter={() => setHoveredItem('proj:' + p.id)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <span>{p.name}</span>
                {unreadCounts[p.id] && (
                  <span style={sharedStyles.unreadBadge}>
                    {unreadCounts[p.id] > 99 ? '99+' : unreadCounts[p.id]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
