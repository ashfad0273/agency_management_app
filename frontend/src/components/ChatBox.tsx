import { useState, useEffect, useRef, FormEvent } from 'react';
import { ChatService, Message } from '../services/ChatService';
import { supabase } from '../api/supabaseClient';

interface Props {
  projectId?: string | null;
  channelId?: string | null;
  conversationId?: string | null;
  title?: string;
}

export default function ChatBox({ projectId, channelId, conversationId, title }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Determine display title
  const displayTitle = title ?? (
    conversationId ? 'Direct Message' :
    channelId ? 'Channel Chat' :
    projectId === null ? 'Global Chat' :
    'Project Chat'
  );

  // Build the realtime filter and channel name based on scope
  const getScope = () => {
    if (conversationId) return { filter: `conversation_id=eq.${conversationId}`, channel: `dm:${conversationId}` };
    if (channelId) return { filter: `channel_id=eq.${channelId}`, channel: `channel:${channelId}` };
    if (projectId === null) return { filter: 'project_id=is.null', channel: 'chat:global' };
    if (projectId) return { filter: `project_id=eq.${projectId}`, channel: `chat:${projectId}` };
    return { filter: 'project_id=is.null', channel: 'chat:global' };
  };

  useEffect(() => {
    setLoading(true);
    ChatService.getMessages(projectId, channelId, conversationId)
      .then((msgs) => {
        setMessages(msgs);
        const names: Record<string, string> = {};
        for (const m of msgs) {
          if (m.profiles?.email) {
            names[m.sender_id] = m.profiles.email.split('@')[0];
          }
        }
        setSenderNames((prev) => ({ ...prev, ...names }));
      })
      .finally(() => setLoading(false));

    // Mark as read when entering this chat
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

        // Fetch sender display name if we don't already have it
        if (!senderNames[newMsg.sender_id]) {
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
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const getDisplayName = (m: Message): string => {
    if (senderNames[m.sender_id]) return senderNames[m.sender_id];
    if (m.profiles?.email) return m.profiles.email.split('@')[0];
    return m.sender_id.substring(0, 5);
  };

  return (
    <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px', width: '300px' }}>
      <h6>{displayTitle}</h6>
      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
          Loading messages...
        </div>
      ) : (
        <div style={{ height: '200px', overflowY: 'scroll', marginBottom: '10px', background: '#f9f9f9', padding: '5px' }}>
          {messages.length === 0 ? (
            <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} style={{ marginBottom: '5px', borderBottom: '1px solid #eee' }}>
                <small>{new Date(m.created_at).toLocaleTimeString()}</small>
                <br />
                <strong>{getDisplayName(m)}:</strong> {m.content}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
      <form onSubmit={handleSend}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
