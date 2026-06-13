import { useEffect, useRef, useCallback, useState } from 'react';
import * as signalR from '@microsoft/signalr';

import { getApiBase } from '../api/api';

const HUB = '/hubs/cloud-stream';

const KEY_VK = {
  Backspace: 0x08, Tab: 0x09, Enter: 0x0D, Escape: 0x1B, Space: 0x20,
  ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28,
  Delete: 0x2E,
  ShiftLeft: 0xA0, ShiftRight: 0xA1,
  ControlLeft: 0xA2, ControlRight: 0xA3,
  AltLeft: 0xA4, AltRight: 0xA5,
  MetaLeft: 0x5B, MetaRight: 0x5C,
  F1: 0x70, F2: 0x71, F3: 0x72, F4: 0x73, F5: 0x74, F6: 0x75,
  F7: 0x76, F8: 0x77, F9: 0x78, F10: 0x79, F11: 0x7A, F12: 0x7B,
};

function getHubUrl() {
  const base = getApiBase().replace(/\/api\/?$/, '');
  return `${base}${HUB}`;
}

function resolveVk(e) {
  if (KEY_VK[e.code] != null) return KEY_VK[e.code];
  if (e.code?.startsWith('Key') && e.code.length === 4) return e.code.charCodeAt(3);
  if (e.code?.startsWith('Digit') && e.code.length === 6) return e.code.charCodeAt(5);
  if (e.key?.length === 1) return e.key.toUpperCase().charCodeAt(0);
  return null;
}

export function useRealStream(session, enabled, onSessionEnded) {
  const connRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(new Image());
  const [streamStatus, setStreamStatus] = useState('idle');
  const [streamError, setStreamError] = useState(null);
  const lastMoveAt = useRef(0);

  useEffect(() => {
    if (!enabled || !session?.session_id) {
      setStreamStatus('idle');
      setStreamError(null);
      return;
    }

    const hubUrl = getHubUrl();
    setStreamStatus('connecting');
    setStreamError(null);

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, { withCredentials: true })
      .withAutomaticReconnect()
      .build();

    connRef.current = conn;
    imgRef.current.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = imgRef.current.width;
      canvas.height = imgRef.current.height;
      ctx.drawImage(imgRef.current, 0, 0);
      setStreamStatus('streaming');
    };

    conn.on('ReceiveFrame', (frameBase64) => {
      imgRef.current.src = `data:image/jpeg;base64,${frameBase64}`;
    });

    conn.on('StreamReady', () => {
      setStreamStatus('ready');
      setStreamError(null);
    });

    conn.on('SessionEnded', () => {
      onSessionEnded?.('game_closed');
    });

    conn.onreconnecting((err) => {
      setStreamStatus('reconnecting');
      setStreamError(err?.message || 'Reconnecting to stream…');
    });

    conn.onreconnected(() => {
      setStreamStatus('connected');
      setStreamError(null);
      conn.invoke('PlayerJoin', session.session_id).catch(() => {});
    });

    conn.onclose((err) => {
      setStreamStatus('disconnected');
      if (err) setStreamError(err.message || 'Stream connection closed');
    });

    conn.start()
      .then(() => conn.invoke('PlayerJoin', session.session_id))
      .then(() => {
        setStreamStatus('connected');
        console.info('[cloud-stream] Player joined session', session.session_id, hubUrl);
      })
      .catch((err) => {
        console.error('[cloud-stream] Connect failed', err);
        setStreamStatus('error');
        setStreamError(err.message || 'Could not connect to stream hub — is the API running?');
      });

    return () => {
      conn.stop().catch(() => {});
      connRef.current = null;
    };
  }, [enabled, session?.session_id, onSessionEnded]);

  const sendInput = useCallback((input) => {
    connRef.current?.invoke('SendInput', session.session_id, input).catch(() => {});
  }, [session?.session_id]);

  const bindViewport = useCallback((el) => {
    if (!el || !enabled) return () => {};
    const rect = () => el.getBoundingClientRect();
    const scale = (clientX, clientY) => {
      const r = rect();
      const canvas = canvasRef.current;
      const w = canvas?.width || 1920;
      const h = canvas?.height || 1080;
      const x = Math.max(0, Math.min(w - 1, Math.round(((clientX - r.left) / r.width) * w)));
      const y = Math.max(0, Math.min(h - 1, Math.round(((clientY - r.top) / r.height) * h)));
      return { x, y };
    };

    const onMove = (e) => {
      const now = Date.now();
      if (now - lastMoveAt.current < 33) return;
      lastMoveAt.current = now;
      const { x, y } = scale(e.clientX, e.clientY);
      sendInput({ type: 'move', x, y });
    };
    const onDown = (e) => {
      e.preventDefault();
      el.focus();
      const { x, y } = scale(e.clientX, e.clientY);
      sendInput({ type: 'mousedown', x, y, button: e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left' });
    };
    const onUp = (e) => {
      const { x, y } = scale(e.clientX, e.clientY);
      sendInput({ type: 'mouseup', x, y, button: e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left' });
    };
    const onKey = (e, down) => {
      if (['Tab', 'F5'].includes(e.key)) return;
      if (e.key === 'F11') return;
      e.preventDefault();
      const vk = resolveVk(e);
      if (!vk) return;
      sendInput({ type: down ? 'keydown' : 'keyup', code: e.code, key: e.key, vk });
    };

    const onContextMenu = (e) => e.preventDefault();
    const onKeyDown = (e) => onKey(e, true);
    const onKeyUp = (e) => onKey(e, false);

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('contextmenu', onContextMenu);
    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('keyup', onKeyUp);
    el.tabIndex = 0;
    el.style.outline = 'none';

    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled, sendInput]);

  return { canvasRef, bindViewport, streamStatus, streamError };
}
