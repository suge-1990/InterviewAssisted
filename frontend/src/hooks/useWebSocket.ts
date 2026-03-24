'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WSMessage } from '@/lib/types';

interface UseWebSocketOptions {
  url: string;
  onMessage: (msg: WSMessage) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

export function useWebSocket({ url, onMessage, onStatusChange }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const reconnectDelay = useRef(1000);
  const pingTimer = useRef<ReturnType<typeof setInterval>>();
  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  const urlRef = useRef(url);
  const mountedRef = useRef(true);

  onMessageRef.current = onMessage;
  onStatusChangeRef.current = onStatusChange;
  urlRef.current = url;

  const updateStatus = useCallback((s: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    setStatus(s);
    onStatusChangeRef.current?.(s);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    updateStatus('connecting');
    const ws = new WebSocket(urlRef.current);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] connected');
      updateStatus('connected');
      reconnectDelay.current = 1000;
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ command: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;
        onMessageRef.current(data);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      console.log('[WS] disconnected');
      updateStatus('disconnected');
      if (pingTimer.current) clearInterval(pingTimer.current);
      if (mountedRef.current) {
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
          connect();
        }, reconnectDelay.current);
      }
    };

    ws.onerror = () => {
      updateStatus('error');
    };
  }, [updateStatus]);

  const disconnect = useCallback(() => {
    mountedRef.current = false;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (pingTimer.current) clearInterval(pingTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    updateStatus('disconnected');
  }, [updateStatus]);

  const sendAudio = useCallback((blob: Blob, source: 'mic' | 'system' = 'mic') => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      blob.arrayBuffer().then((buf) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // Prepend 1 byte: 0x01 = mic (candidate), 0x02 = system (interviewer)
          const tag = source === 'system' ? 0x02 : 0x01;
          const tagged = new Uint8Array(buf.byteLength + 1);
          tagged[0] = tag;
          tagged.set(new Uint8Array(buf), 1);
          wsRef.current.send(tagged.buffer);
        }
      });
    }
  }, []);

  const sendCommand = useCallback((cmd: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    }
  }, []);

  // Connect once on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingTimer.current) clearInterval(pingTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { wsRef, status, connect, disconnect, sendAudio, sendCommand };
}
