import { useState, useEffect, FormEvent } from 'react';
import ChatBox from './ChatBox';
import { ChannelService, ChannelWithMembership } from '../services/ChannelService';
import { ConversationService, ConversationWithUser } from '../services/ConversationService';
import { ProjectMemberService } from '../services/ProjectMemberService';
import { Project } from '../services/ProjectService';
import { ChatService } from '../services/ChatService';
import { usePermission, Permissions } from '../hooks/usePermission';
import { tokens, sharedStyles, radius, fontSize } from '../theme/tokens';

interface OrgMemberDisplay {
  id: string;
  email: string | null;
  display: string;
  role_name: string | null;
}

type ActiveChat =
  | { type: 'channel'; channelId: string; channelName: string }
  | { type: 'project'; projectId: string; projectName: string }
  | { type: 'dm'; conversationId: string; otherUserName: string };

export default function ChatLayout() {
  const { can } = usePermission();
  const canManageChannels = can(Permissions.Chat.ManageChannels);

  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [channels, setChannels] = useState<ChannelWithMembership[]>([]);
  const [conversations, setConversations] = useState<ConversationWithUser[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMemberDisplay[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ type: 'error'; message: string } | null>(null);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const showFeedback = (type: 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const activeChannelId = activeChat?.type === 'channel' ? (activeChat.channelId || undefined) : undefined;
  const activeProjectId = activeChat?.type === 'project' ? activeChat.projectId : undefined;
  const activeConversationId = activeChat?.type === 'dm' ? activeChat.conversationId : undefined;
  const isActiveChannel = activeChat?.type === 'channel';

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
      const [channelData, conversationData, projectData, memberData] = await Promise.all([
        ChannelService.getChannelsWithMembership().catch(() => undefined),
        ConversationService.getConversations().catch(() => undefined),
        ProjectMemberService.getUserProjects().catch(() => undefined),
        ConversationService.getOrgMembersForDm().catch(() => [] as OrgMemberDisplay[]),
      ]);
      if (channelData !== undefined) setChannels(channelData);
      if (conversationData !== undefined) setConversations(conversationData);
      if (projectData !== undefined) setProjects(projectData);
      if (memberData !== undefined) setOrgMembers(memberData);
      setLoaded(true);
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
  };

  const handleSelectProject = (project: Project) => {
    setActiveChat({ type: 'project', projectId: project.id, projectName: project.name });
    ChatService.markAsRead(project.id);
    setUnreadCounts((prev) => { const next = { ...prev }; delete next[project.id]; return next; });
  };

  const handleStartDm = async (otherUserId: string) => {
    try {
      const conversationId = await ConversationService.createOrGetConversation(otherUserId);
      await loadData();
      const dm = (await ConversationService.getConversations()).find(d => d.conversation_id === conversationId);
      if (dm) handleSelectDm(dm);
    } catch (error) {
      console.error('Error starting DM:', error);
    }
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
      // Add selected members to private channel
      if (newChannelPrivate && selectedMemberIds.size > 0) {
        const results = await Promise.allSettled(
          Array.from(selectedMemberIds).map(uid =>
            ChannelService.addMember(channel.id, uid, 'member')
          )
        );
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
          console.warn(`${failures.length} member(s) could not be added to private channel`);
          showFeedback('error', `Channel created but ${failures.length} member(s) could not be added`);
        }
      }
      setNewChannelName('');
      setNewChannelDesc('');
      setNewChannelPrivate(false);
      setSelectedMemberIds(new Set());
      setShowCreateChannel(false);
      await loadData();
      setActiveChat({ type: 'channel', channelId: channel.id, channelName: `#${channel.name}` });
    } catch (error: unknown) {
      let errMsg = 'Unknown error';
      if (error instanceof Error) {
        errMsg = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const obj = error as Record<string, unknown>;
        errMsg = String(obj.message ?? obj.error ?? obj.details ?? JSON.stringify(error));
      }
      console.error('Error creating channel:', error);
      showFeedback('error', 'Error creating channel: ' + errMsg);
    }
    setCreatingChannel(false);
  };

  const toggleMemberSelect = (id: string) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isChannelActive = (chId: string) => activeChat?.type === 'channel' && activeChat.channelId === chId;
  const isDmActive = (convId: string) => activeChat?.type === 'dm' && activeChat.conversationId === convId;
  const isProjectActive = (projId: string) => activeChat?.type === 'project' && activeChat.projectId === projId;

  const activeTitle = activeChat?.type === 'channel'
    ? activeChat.channelName
    : activeChat?.type === 'dm'
    ? activeChat.otherUserName
    : activeChat?.projectName ?? '';

  const sidebarItemStyle = (isActive: boolean) => ({
    padding: '7px 12px 7px 12px',
    cursor: 'pointer',
    borderRadius: radius.sm,
    background: isActive ? tokens.surfaceHover : 'transparent',
    color: isActive ? tokens.textPrimary : tokens.textSecondary,
    marginBottom: 2,
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
                  <input type="checkbox" checked={newChannelPrivate} onChange={(e) => {
                    setNewChannelPrivate(e.target.checked);
                    if (!e.target.checked) setSelectedMemberIds(new Set());
                  }} />
                  Private channel
                </label>

                {newChannelPrivate && (
                  <div style={{ marginBottom: 6, maxHeight: 120, overflowY: 'auto', border: `1px solid ${tokens.borderDefault}`, borderRadius: radius.sm, padding: 4 }}>
                    <div style={{ fontSize: fontSize.xs, color: tokens.textDim, marginBottom: 4, padding: '0 4px' }}>Select members:</div>
                    {orgMembers.map(m => (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', cursor: 'pointer', borderRadius: radius.sm, fontSize: fontSize.sm, color: tokens.textSecondary }}>
                        <input type="checkbox" checked={selectedMemberIds.has(m.id)} onChange={() => toggleMemberSelect(m.id)} />
                        <span style={{ width: 20, height: 20, borderRadius: '50%', background: tokens.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0, color: tokens.textPrimary }}>
                          {(m.email || '?').charAt(0).toUpperCase()}
                        </span>
                        <span style={{ flex: 1 }}>{m.display}</span>
                        {m.role_name && <span style={{ ...sharedStyles.badge('neutral'), fontSize: 9, padding: '1px 4px' }}>{m.role_name}</span>}
                      </label>
                    ))}
                    {orgMembers.length === 0 && <div style={{ fontSize: fontSize.xs, color: tokens.textDim, padding: 4 }}>No members available</div>}
                  </div>
                )}

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
                  style={sidebarItemStyle(isChannelActive(ch.id))}
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

          {/* Direct Messages — auto-populated with org members */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h5 style={sectionHeaderStyle}>DIRECT MESSAGES</h5>
            </div>

            {/* Existing conversations */}
            {conversations.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                {conversations.map((dm) => (
                  <div
                    key={dm.conversation_id}
                    onClick={() => handleSelectDm(dm)}
                    style={sidebarItemStyle(isDmActive(dm.conversation_id))}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: tokens.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0, color: tokens.textPrimary }}>
                        {dm.other_user_display.charAt(0).toUpperCase()}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{dm.other_user_display}</span>
                    </div>
                    {unreadCounts['dm:' + dm.conversation_id] && (
                      <span style={sharedStyles.unreadBadge}>
                        {unreadCounts['dm:' + dm.conversation_id] > 99 ? '99+' : unreadCounts['dm:' + dm.conversation_id]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* All org members — start a new DM by clicking */}
            <div style={{ marginTop: conversations.length > 0 ? 4 : 0 }}>
              {orgMembers.filter(m => !conversations.some(dm => dm.other_user_id === m.id)).slice(0, 50).map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleStartDm(m.id)}
                  style={{
                    padding: '6px 12px',
                    cursor: 'pointer',
                    borderRadius: radius.sm,
                    color: tokens.textSecondary,
                    fontSize: fontSize.base,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = tokens.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: tokens.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0, color: tokens.textPrimary }}>
                    {(m.email || '?').charAt(0).toUpperCase()}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.display}</span>
                  {m.role_name && (
                    <span style={{ ...sharedStyles.badge('neutral'), fontSize: 9, padding: '1px 5px', flexShrink: 0 }}>
                      {m.role_name}
                    </span>
                  )}
                </div>
              ))}
              {orgMembers.length === 0 && conversations.length === 0 && loaded && (
                <p style={{ ...sharedStyles.textMuted, margin: '5px 0' }}>No members yet</p>
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
                style={sidebarItemStyle(isProjectActive(p.id))}
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
        {activeChat ? (
          <ChatBox
            projectId={activeProjectId}
            channelId={activeChannelId}
            conversationId={activeConversationId}
            title={activeTitle}
          />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tokens.textDim,
            fontSize: fontSize.base,
          }}>
            Select a channel or conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
