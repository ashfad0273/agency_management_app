import { useState, useEffect, useRef, FormEvent, memo } from 'react';
import { ChatService, Message } from '../services/ChatService';
import { supabase } from '../api/supabaseClient';
import { tokens, sharedStyles, radius, fontSize } from '../theme/tokens';

interface Props {
  projectId?: string | null;
  channelId?: string | null;
  conversationId?: string | null;
  title?: string;
}

function ChatBox({ projectId, channelId, conversationId, title }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const senderNamesRef = useRef(senderNames);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { senderNamesRef.current = senderNames; }, [senderNames]);

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
        ChatService.markAsRead(projectId, channelId, conversationId);
      })
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(subscription);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, channelId, conversationId]);

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
    } catch (err) {
      console.error("Error sending message:", err);
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
      }}>
        {displayTitle}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
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
            {messages.map((m) => (
              <div key={m.id} style={{
                marginBottom: 8,
                padding: '8px 12px',
                borderRadius: radius.sm,
                background: tokens.canvasBg,
                border: `1px solid ${tokens.borderDefault}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <strong style={{ color: tokens.accentPrimary, fontSize: fontSize.sm }}>
                    {getDisplayName(m)}
                  </strong>
                  <span style={{ color: tokens.textDim, fontSize: fontSize.xs }}>
                    {new Date(m.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ color: tokens.textPrimary, fontSize: fontSize.base, lineHeight: 1.5 }}>
                  {m.content}
                </div>
              </div>
            ))}
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
            onChange={(e) => setContent(e.target.value)}
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
    </div>
  );
}

export default memo(ChatBox);
