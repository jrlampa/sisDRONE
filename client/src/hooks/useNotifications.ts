import { useEffect, useRef, useState, useCallback } from 'react';

export interface AppNotification {
  id: string;
  type: 'ahi_critical' | 'inspection_critical' | 'work_order_critical';
  title: string;
  message: string;
  pole_id?: number;
  work_order_id?: number;
  tenant_id: number;
  timestamp: number;
}

const WS_URL =
  (import.meta.env.VITE_WS_URL ?? `ws://localhost:3001`) + '/ws/notifications';

/** Maximum number of notifications kept in-memory (oldest auto-evicted) */
const MAX_NOTIFICATIONS = 10;

export function useNotifications(tenantId: number | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const connect = useCallback(() => {
    if (!tenantId) return;

    const url = `${WS_URL}?tenant_id=${tenantId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as Omit<AppNotification, 'id'>;
        const notification: AppNotification = {
          ...data,
          id: `${data.type}-${data.timestamp}-${Math.random().toString(36).slice(2)}`,
        };
        setNotifications((prev) => [notification, ...prev].slice(0, MAX_NOTIFICATIONS));
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      // reconnect after 5 s unless component unmounted
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [tenantId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { notifications, dismiss };
}
