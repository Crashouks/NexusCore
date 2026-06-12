import { useState, useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { api } from '../api/api';

const HUB_URL = import.meta.env.VITE_HUB_URL || '/hubs/chat';

export default function QueueChat({ chatId, title = 'Queue Lobby Chat' }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const connRef = useRef(null);

  const scrollBottom = () => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  };

  const loadHistory = useCallback(async () => {
    if (!chatId) return;
    try {
      const history = await api.chat.messages(chatId);
      setMessages(Array.isArray(history) ? history : []);
      setTimeout(scrollBottom, 50);
    } catch (err) {
      setError(err.message || 'Failed to load messages');
    }
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    let active = true;
    setConnected(false);
    setError('');

    const connect = async () => {
      try {
        await api.chat.join(chatId);
        await loadHistory();
        if (!active) return;

        const token = localStorage.getItem('nc_token');
        const connection = new signalR.HubConnectionBuilder()
          .withUrl(`${HUB_URL}?access_token=${encodeURIComponent(token || '')}`)
          .withAutomaticReconnect()
          .build();

        connection.on('ReceiveMessage', (msg) => {
          if (!active) return;
          setMessages((prev) => {
            if (prev.some((m) => m.message_id === msg.message_id)) return prev;
            return [...prev, msg];
          });
          setTimeout(scrollBottom, 50);
        });

        await connection.start();
        if (!active) {
          await connection.stop();
          return;
        }
        await connection.invoke('JoinChat', chatId);
        connRef.current = connection;
        if (active) setConnected(true);
      } catch (err) {
        if (active) setError(err.message || 'Chat connection failed');
      }
    };

    connect();

    return () => {
      active = false;
      setConnected(false);
      const connection = connRef.current;
      connRef.current = null;
      if (connection) {
        connection.invoke('LeaveChat', chatId).catch(() => {});
        connection.stop();
      }
    };
  }, [chatId, loadHistory]);

  const send = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !connRef.current || !connected) return;
    setText('');
    try {
      await connRef.current.invoke('SendMessage', chatId, trimmed);
    } catch (err) {
      setError(err.message || 'Send failed');
    }
  };

  if (!chatId) return null;

  return (
    <div style={{
      marginTop: 20, textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="font-display" style={{ fontSize: 14, color: 'var(--accent-glow)' }}>{title}</span>
        <span style={{ fontSize: 11, color: connected ? 'var(--neon)' : 'var(--text-dim)' }}>
          {connected ? '● Live' : '○ Connecting…'}
        </span>
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</p>}
      <div
        ref={listRef}
        style={{
          height: 160, overflowY: 'auto', background: 'var(--bg-hover)', borderRadius: 8,
          padding: 10, marginBottom: 10, fontSize: 13,
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: 40 }}>
            No messages yet. Say hi to other players in the queue!
          </p>
        )}
        {messages.map((m) => (
          <div key={m.message_id} style={{ marginBottom: 8 }}>
            <span style={{ color: 'var(--accent-glow)', fontWeight: 600 }}>{m.username}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 10, marginLeft: 6 }}>
              {new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div style={{ color: 'var(--text)', marginTop: 2 }}>{m.text}</div>
          </div>
        ))}
      </div>
      <form onSubmit={send} style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message players in queue…"
          maxLength={2000}
          disabled={!connected}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13,
          }}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13 }} disabled={!connected}>
          Send
        </button>
      </form>
    </div>
  );
}
