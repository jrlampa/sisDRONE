import { useEffect } from 'react';
import { X, AlertTriangle, Zap, ClipboardList } from 'lucide-react';
import type { AppNotification } from '../hooks/useNotifications';

interface Props {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
  onPoleClick?: (poleId: number) => void;
  autoDismissMs?: number;
}

const ICON_MAP = {
  ahi_critical: <Zap className="w-5 h-5 text-red-400" />,
  inspection_critical: <AlertTriangle className="w-5 h-5 text-orange-400" />,
  work_order_critical: <ClipboardList className="w-5 h-5 text-yellow-400" />,
};

const COLOR_MAP = {
  ahi_critical: 'border-red-500 bg-red-950',
  inspection_critical: 'border-orange-500 bg-orange-950',
  work_order_critical: 'border-yellow-500 bg-yellow-950',
};

function NotificationCard({
  notification,
  onDismiss,
  onPoleClick,
  autoDismissMs = 8000,
}: {
  notification: AppNotification;
  onDismiss: (id: string) => void;
  onPoleClick?: (poleId: number) => void;
  autoDismissMs?: number;
}) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(notification.id), autoDismissMs);
    return () => clearTimeout(t);
  }, [notification.id, onDismiss, autoDismissMs]);

  return (
    <div
      className={`relative flex items-start gap-3 p-3 border rounded-lg shadow-lg text-white text-sm max-w-xs ${COLOR_MAP[notification.type]}`}
      role="alert"
    >
      <span className="mt-0.5 shrink-0">{ICON_MAP[notification.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{notification.title}</p>
        <p className="text-xs opacity-80 break-words">{notification.message}</p>
        {notification.pole_id && onPoleClick && (
          <button
            className="mt-1 text-xs underline opacity-70 hover:opacity-100"
            onClick={() => onPoleClick(notification.pole_id!)}
          >
            Ver poste #{notification.pole_id}
          </button>
        )}
      </div>
      <button
        className="shrink-0 opacity-60 hover:opacity-100 ml-1"
        onClick={() => onDismiss(notification.id)}
        aria-label="Fechar notificação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function NotificationBanner({
  notifications,
  onDismiss,
  onPoleClick,
  autoDismissMs,
}: Props) {
  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {notifications.map((n) => (
        <div key={n.id} className="pointer-events-auto">
          <NotificationCard
            notification={n}
            onDismiss={onDismiss}
            onPoleClick={onPoleClick}
            autoDismissMs={autoDismissMs}
          />
        </div>
      ))}
    </div>
  );
}
