import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { getApiBase } from '../api/api';

const HUB = '/hubs/cloud-stream';

function getHubUrl() {
  const base = getApiBase().replace(/\/api\/?$/, '');
  return `${base}${HUB}`;
}

export function useSpectatorStream(watchTarget, enabled) {
  const connRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(new Image());
  const canViewRef = useRef(false);
  const [streamStatus, setStreamStatus] = useState('idle');
  const [watchState, setWatchState] = useState(null);

  const sessionId = watchTarget?.session_id;
  const canView = watchState?.can_view ?? watchTarget?.can_view ?? false;

  useEffect(() => {
    canViewRef.current = canView;
  }, [canView]);

  useEffect(() => {
    if (!enabled || !sessionId) {
      setStreamStatus('idle');
      setWatchState(null);
      return;
    }

    const hubUrl = getHubUrl();
    setStreamStatus('connecting');
    setWatchState(watchTarget);
    canViewRef.current = !!watchTarget?.can_view;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, { withCredentials: true })
      .withAutomaticReconnect()
      .build();

    connRef.current = conn;

    imgRef.current.onload = () => {
      if (!canViewRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = imgRef.current.width;
      canvas.height = imgRef.current.height;
      ctx.drawImage(imgRef.current, 0, 0);
      setStreamStatus('streaming');
    };

    conn.on('ReceiveFrame', (frameBase64) => {
      if (!canViewRef.current) return;
      imgRef.current.src = `data:image/jpeg;base64,${frameBase64}`;
    });

    conn.on('WatchState', (state) => {
      canViewRef.current = !!state.can_view;
      setWatchState(state);
      if (!state.can_view) setStreamStatus('private');
      else setStreamStatus(state.is_real_stream ? 'connected' : 'simulated');
    });

    conn.on('WatchPrivacyChanged', (state) => {
      canViewRef.current = !!state.can_view;
      setWatchState(prev => ({ ...(prev || {}), ...state }));
      if (!state.can_view) setStreamStatus('private');
      else setStreamStatus(prev => (prev === 'private' ? 'connected' : prev));
    });

    conn.on('StreamReady', () => {
      if (canViewRef.current) setStreamStatus('ready');
    });

    conn.on('SessionEnded', () => setStreamStatus('ended'));

    conn.onreconnecting(() => setStreamStatus('reconnecting'));
    conn.onreconnected(() => {
      conn.invoke('SpectatorJoin', sessionId).catch(() => {});
    });
    conn.onclose(() => setStreamStatus('disconnected'));

    conn.start()
      .then(() => conn.invoke('SpectatorJoin', sessionId))
      .catch(() => setStreamStatus('error'));

    return () => {
      conn.stop().catch(() => {});
      connRef.current = null;
    };
  }, [enabled, sessionId, watchTarget]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!canvas.width) canvas.width = 1920;
    if (!canvas.height) canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return {
    canvasRef,
    streamStatus,
    watchState,
    canView,
    clearCanvas,
  };
}
