import { useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

const HUB = '/hubs/cloud-stream';

function getHubUrl() {
  const api = import.meta.env.VITE_API_URL || '/api';
  const base = api.replace(/\/api\/?$/, '');
  return `${base}${HUB}`;
}

export function useRealStream(session, enabled) {
  const connRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(new Image());

  useEffect(() => {
    if (!enabled || !session?.session_id) return;

    const token = localStorage.getItem('nc_token');
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(getHubUrl(), { accessTokenFactory: () => token || '' })
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
    };

    conn.on('ReceiveFrame', (frameBase64) => {
      imgRef.current.src = `data:image/jpeg;base64,${frameBase64}`;
    });

    conn.start()
      .then(() => conn.invoke('PlayerJoin', session.session_id))
      .catch(console.error);

    return () => {
      conn.stop().catch(() => {});
      connRef.current = null;
    };
  }, [enabled, session?.session_id]);

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
      return {
        x: Math.round(((clientX - r.left) / r.width) * w),
        y: Math.round(((clientY - r.top) / r.height) * h),
      };
    };

    const onMove = (e) => {
      const { x, y } = scale(e.clientX, e.clientY);
      sendInput({ type: 'move', x, y });
    };
    const onDown = (e) => {
      e.preventDefault();
      const { x, y } = scale(e.clientX, e.clientY);
      sendInput({ type: 'mousedown', x, y, button: e.button === 2 ? 'right' : 'left' });
    };
    const onUp = (e) => {
      const { x, y } = scale(e.clientX, e.clientY);
      sendInput({ type: 'mouseup', x, y, button: e.button === 2 ? 'right' : 'left' });
    };
    const onKey = (e, down) => {
      if (['Tab', 'F5', 'F11'].includes(e.key)) return;
      e.preventDefault();
      sendInput({ type: down ? 'keydown' : 'keyup', key: e.key });
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('keydown', e => onKey(e, true));
    el.addEventListener('keyup', e => onKey(e, false));
    el.tabIndex = 0;

    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mouseup', onUp);
    };
  }, [enabled, sendInput]);

  return { canvasRef, bindViewport };
}
