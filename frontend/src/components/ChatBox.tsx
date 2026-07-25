import { useState, useEffect, useRef, FormEvent, memo, useCallback } from 'react';
import { ChatService, Message, MessageReaction } from '../services/ChatService';
import { supabase } from '../api/supabaseClient';
import { tokens, sharedStyles, radius, fontSize } from '../theme/tokens';

interface Props {
  projectId?: string | null;
  channelId?: string | null;
  conversationId?: string | null;
  title?: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function shouldGroup(a: Message, b: Message): boolean {
  if (a.sender_id !== b.sender_id) return false;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() < GROUP_WINDOW_MS;
}

function ChatBox({ projectId, channelId, conversationId, title }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const senderNamesRef = useRef(senderNames);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const scopeRef = useRef({ projectId, channelId, conversationId });

  scopeRef.current = { projectId, channelId, conversationId };

  useEffect(() => { senderNamesRef.current = senderNames; }, [senderNames]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const displayTitle = title ?? (
    conversationId ? 'Direct Message' :
    channelId ? 'Channel Chat' :
    projectId === null ? 'Global Chat' :
    'Project Chat'
  );

  const getScope = () => {
    if (conversationId) return { filter: `conversation_id=eq.${conversationId}`, channel: `dm:${conversationId}` };
    if (channelId) return { filter: `channel_id=eq.${channelId}`, channel: `channel:${channelId}` };
    if (projectId === null) return { filter: 'project_id=is.null', channel: 'chat:global' };
    if (projectId) return { filter: `project_id=eq.${projectId}`, channel: `chat:${projectId}` };
    return { filter: 'project_id=is.null', channel: 'chat:global' };
  };

  const loadReactions = useCallback(async (msgs: Message[]) => {
    const ids = msgs.map(m => m.id);
    if (ids.length === 0) return;
    const { data } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', ids);
    if (data) {
      const grouped: Record<string, MessageReaction[]> = {};
      for (const r of data) {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];
        grouped[r.message_id].push(r);
      }
      setReactions(grouped);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    ChatService.getMessages(projectId, channelId, conversationId)
      .then((msgs) => {
        if (ignore) return;
        setMessages(msgs);
        const names: Record<string, string> = {};
        for (const m of msgs) {
          if (m.profiles?.email) {
            names[m.sender_id] = m.profiles.email.split('@')[0];
          }
        }
        setSenderNames((prev) => ({ ...prev, ...names }));
        loadReactions(msgs);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    ChatService.markAsRead(projectId, channelId, conversationId);

    const { filter, channel: channelName } = getScope();

    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter
      }, (payload) => {
        const newMsg = payload.new as Message;

        if (!senderNamesRef.current[newMsg.sender_id]) {
          ChatService.getSenderDisplayName(newMsg.sender_id)
            .then((name) => {
              setSenderNames((prev) => ({ ...prev, [newMsg.sender_id]: name }));
            })
            .catch(() => {
              setSenderNames((prev) => ({ ...prev, [newMsg.sender_id]: newMsg.sender_id.substring(0, 5) }));
            });
        }

        setMessages((prev) => [...prev, newMsg]);
        ChatService.markAsRead(scopeRef.current.projectId, scopeRef.current.channelId, scopeRef.current.conversationId);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter
      }, (payload) => {
        const deletedId = payload.old.id;
        setMessages((prev) => prev.filter(m => m.id !== deletedId));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages((prev) => prev.map(m => m.id === updated.id ? { ...m, content: updated.content } : m));
      })
      .subscribe();

    // Presence channel for typing indicators
    const scopeKey = getScope().channel;
    const presenceChannel = supabase.channel(`typing:${scopeKey}`, {
      config: { presence: { key: currentUserId ?? 'unknown' } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const typing: string[] = [];
        for (const key of Object.keys(state)) {
          if (key !== currentUserId) {
            const presences = state[key] as unknown as { typing: boolean }[];
            if (presences.some((p: { typing: boolean }) => p.typing)) typing.push(key);
          }
        }
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ typing: false });
        }
      });

    presenceChannelRef.current = presenceChannel;

    return () => {
      ignore = true;
      supabase.removeChannel(subscription);
      presenceChannelRef.current?.untrack();
      supabase.removeChannel(presenceChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, channelId, conversationId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await ChatService.sendMessage(projectId, content, channelId, conversationId);
      setContent('');
      inputRef.current?.focus();
      // Stop typing indicator
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      presenceChannelRef.current?.track({ typing: false });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleTyping = () => {
    presenceChannelRef.current?.track({ typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      presenceChannelRef.current?.track({ typing: false });
    }, 2000);
  };

  const handleDelete = async (messageId: string) => {
    try {
      await ChatService.deleteMessage(messageId);
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  const handleEdit = async (messageId: string) => {
    if (!editContent.trim()) return;
    try {
      await ChatService.editMessage(messageId, editContent.trim());
      setEditingMessageId(null);
      setEditContent('');
    } catch (err) {
      console.error("Error editing message:", err);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      const added = await ChatService.toggleReaction(messageId, emoji);
      // Optimistically update local state
      const updated = await ChatService.getReactions(messageId);
      setReactions((prev) => ({ ...prev, [messageId]: updated }));
      if (added) {
        setShowEmojiPicker(null);
      }
    } catch (err) {
      console.error("Error toggling reaction:", err);
    }
  };

  const getDisplayName = (m: Message): string => {
    if (senderNames[m.sender_id]) return senderNames[m.sender_id];
    if (m.profiles?.email) return m.profiles.email.split('@')[0];
    return m.sender_id.substring(0, 5);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = (e.target as HTMLElement).closest('form');
      if (form) form.requestSubmit();
    }
  };

  // Build grouped messages with date separators
  const renderMessages = () => {
    const elements: React.ReactNode[] = [];
    let lastDate = '';

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const msgDate = formatDate(m.created_at);

      // Date separator
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        elements.push(
          <div key={`date-${i}`} style={{
            textAlign: 'center',
            margin: '16px 0 12px',
            position: 'relative',
          }}>
            <span style={{
              background: tokens.surfaceInset,
              color: tokens.textDim,
              fontSize: fontSize.xs,
              padding: '0 10px',
              fontWeight: 600,
            }}>
              {msgDate}
            </span>
          </div>
        );
      }

      const isOwn = m.sender_id === currentUserId;
      const prevMsg = i > 0 ? messages[i - 1] : null;
      const isGrouped = prevMsg && shouldGroup(prevMsg, m);
      const msgReactions = reactions[m.id] ?? [];
      const groupedEmojis: Record<string, number> = {};
      for (const r of msgReactions) {
        groupedEmojis[r.emoji] = (groupedEmojis[r.emoji] || 0) + 1;
      }

      elements.push(
        <div key={m.id} data-group="message" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isOwn ? 'flex-end' : 'flex-start',
          marginBottom: isGrouped ? 2 : 8,
          position: 'relative',
        }}
          onMouseEnter={() => {}}
        >
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            maxWidth: '75%',
            flexDirection: isOwn ? 'row-reverse' : 'row',
          }}>
            {/* Avatar (only show on first message in group or when not grouped) */}
            {!isOwn && (
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: tokens.surfaceHover,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: tokens.textPrimary,
                flexShrink: 0,
                opacity: isGrouped ? 0 : 1,
                transition: 'opacity 0.15s',
                visibility: isGrouped ? 'hidden' : 'visible',
              }}>
                {getDisplayName(m).charAt(0).toUpperCase()}
              </div>
            )}
            {isOwn && (
              <div style={{ width: 28, flexShrink: 0 }} />
            )}

            <div>
              {/* Sender name (only when not grouped) */}
              {!isGrouped && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 2,
                  marginLeft: isOwn ? 0 : 0,
                  justifyContent: isOwn ? 'flex-end' : 'flex-start',
                }}>
                  <strong style={{ color: isOwn ? tokens.accentPrimary : tokens.textSecondary, fontSize: fontSize.xs, fontWeight: 600 }}>
                    {isOwn ? 'You' : getDisplayName(m)}
                  </strong>
                  <span style={{ color: tokens.textDim, fontSize: 10 }}>
                    {formatTime(m.created_at)}
                  </span>
                </div>
              )}

              {/* Message bubble */}
              <div style={{
                padding: '6px 12px',
                borderRadius: radius.md,
                background: isOwn ? 'rgba(58, 149, 154, 0.2)' : tokens.canvasBg,
                border: `1px solid ${isOwn ? 'rgba(58, 149, 154, 0.3)' : tokens.borderDefault}`,
                borderTopLeftRadius: !isOwn && !isGrouped ? radius.sm : radius.md,
                borderTopRightRadius: isOwn && !isGrouped ? radius.sm : radius.md,
                position: 'relative',
              }}>
                {editingMessageId === m.id ? (
                  <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
                    <input
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(m.id); } }}
                      style={{ ...sharedStyles.input, fontSize: fontSize.base }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleEdit(m.id)} style={{ ...sharedStyles.btnPrimary, fontSize: fontSize.xs, padding: '2px 8px' }}>Save</button>
                      <button onClick={() => setEditingMessageId(null)} style={{ ...sharedStyles.btnGhost, fontSize: fontSize.xs, padding: '2px 8px' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: tokens.textPrimary, fontSize: fontSize.base, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </div>
                )}

                {/* Hover actions */}
                <div style={{
                  position: 'absolute',
                  top: -12,
                  [isOwn ? 'left' : 'right']: -4,
                  display: 'flex',
                  gap: 2,
                  opacity: 0,
                  transition: 'opacity 0.15s',
                  zIndex: 10,
                }} className="message-actions">
                  <button
                    onClick={() => { setShowEmojiPicker(showEmojiPicker === m.id ? null : m.id); }}
                    style={{ ...sharedStyles.btnGhost, padding: '2px 5px', fontSize: 12, background: tokens.surfaceFloat, border: `1px solid ${tokens.borderDefault}`, borderRadius: radius.sm, cursor: 'pointer', lineHeight: 1 }}
                    title="React"
                  >
                    😊
                  </button>
                  {isOwn && !editingMessageId && (
                    <>
                      <button
                        onClick={() => { setEditingMessageId(m.id); setEditContent(m.content); }}
                        style={{ ...sharedStyles.btnGhost, padding: '2px 5px', fontSize: 11, background: tokens.surfaceFloat, border: `1px solid ${tokens.borderDefault}`, borderRadius: radius.sm, cursor: 'pointer', lineHeight: 1 }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => { if (window.confirm('Delete this message?')) handleDelete(m.id); }}
                        style={{ ...sharedStyles.btnGhost, padding: '2px 5px', fontSize: 11, background: tokens.surfaceFloat, border: `1px solid ${tokens.borderDefault}`, borderRadius: radius.sm, cursor: 'pointer', lineHeight: 1, color: tokens.danger }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>

                {/* Emoji picker popup */}
                {showEmojiPicker === m.id && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    [isOwn ? 'right' : 'left']: 0,
                    marginBottom: 4,
                    background: tokens.surfaceFloat,
                    border: `1px solid ${tokens.borderDefault}`,
                    borderRadius: radius.md,
                    padding: '4px 6px',
                    display: 'flex',
                    gap: 2,
                    zIndex: 20,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}>
                    {REACTION_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(m.id, emoji)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 16,
                          padding: '2px 4px',
                          borderRadius: radius.sm,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = tokens.surfaceHover}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reactions row */}
              {Object.keys(groupedEmojis).length > 0 && (
                <div style={{ display: 'flex', gap: 3, marginTop: 2, marginLeft: isOwn ? 0 : 0, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                  {Object.entries(groupedEmojis).map(([emoji, count]) => {
                    const userReacted = msgReactions.some(r => r.user_id === currentUserId && r.emoji === emoji);
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(m.id, emoji)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          padding: '1px 5px',
                          borderRadius: radius.sm,
                          border: `1px solid ${userReacted ? 'rgba(58,149,154,0.5)' : tokens.borderDefault}`,
                          background: userReacted ? 'rgba(58,149,154,0.1)' : tokens.canvasBg,
                          cursor: 'pointer',
                          fontSize: 12,
                          color: tokens.textSecondary,
                          lineHeight: 1.4,
                        }}
                      >
                        <span>{emoji}</span>
                        <span style={{ fontSize: 10, fontWeight: 600 }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    return elements;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: tokens.surfaceInset,
      borderLeft: `1px solid ${tokens.borderDefault}`,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${tokens.borderDefault}`,
        color: tokens.textPrimary,
        fontSize: fontSize.md,
        fontWeight: 600,
        background: tokens.canvasBg,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>{displayTitle}</span>
        {typingUsers.length > 0 && (
          <span style={{ color: tokens.textDim, fontSize: fontSize.xs, fontStyle: 'italic' }}>
            {typingUsers.length === 1
              ? (senderNames[typingUsers[0]] || 'Someone') + ' is typing...'
              : `${typingUsers.length} people typing...`}
          </span>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {loading ? (
          <div style={{ ...sharedStyles.textMuted, textAlign: 'center', padding: 40 }}>
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ ...sharedStyles.textMuted, textAlign: 'center', padding: 40 }}>
            No messages yet. Start the conversation!
          </div>
        ) : (
          <div role="log" aria-live="polite" aria-label="Message list">
            {renderMessages()}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${tokens.borderDefault}`, background: tokens.canvasBg }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={content}
            onChange={(e) => { setContent(e.target.value); handleTyping(); }}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a message... (Enter to send)"
            style={{ ...sharedStyles.input, flex: 1 }}
          />
          <button type="submit" style={{
            ...sharedStyles.btnPrimary,
            padding: '8px 16px',
            whiteSpace: 'nowrap',
          }}>
            Send
          </button>
        </form>
      </div>

      {/* CSS for hover actions */}
      <style>{`
        [data-group='message']:hover .message-actions {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}

export default memo(ChatBox);
