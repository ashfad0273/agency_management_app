import React, { useState, useEffect } from 'react';
import { ChatService, Message } from '../services/ChatService';
import { supabase } from '../api/supabaseClient';

interface Props {
  projectId: string | null;
  title?: string;
}

export default function ChatBox({ projectId, title }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');

  const displayTitle = title ?? (projectId === null ? 'Global Chat' : 'Project Chat');

  useEffect(() => {
    ChatService.getMessages(projectId).then(setMessages);

    // Build realtime filter based on projectId
    const filter = projectId === null
      ? 'project_id=is.null'
      : `project_id=eq.${projectId}`;

    const channel = supabase
      .channel(`chat:${projectId ?? 'global'}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await ChatService.sendMessage(projectId, content);
      setContent('');
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  return (
    <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px', width: '300px' }}>
      <h6>{displayTitle}</h6>
      <div style={{ height: '200px', overflowY: 'scroll', marginBottom: '10px', background: '#f9f9f9', padding: '5px' }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: '5px', borderBottom: '1px solid #eee' }}>
            <small>{new Date(m.created_at).toLocaleTimeString()}</small>
            <br />
            <strong>{m.sender_id.substring(0, 5)}:</strong> {m.content}
          </div>
        ))}
      </div>
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
