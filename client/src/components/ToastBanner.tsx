import React from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import type { Toast } from '../hooks/useToast';

interface ToastBannerProps {
  toast: Toast | null;
  onDismiss: () => void;
}

const ICON_MAP = {
  success: <CheckCircle size={15} className="shrink-0" />,
  error:   <AlertCircle size={15} className="shrink-0" />,
  info:    <Info size={15} className="shrink-0" />,
};

const COLOR_MAP = {
  success: 'bg-green-500/15 text-green-400 border-green-500/30',
  error:   'bg-red-500/15 text-red-400 border-red-500/30',
  info:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const ToastBanner: React.FC<ToastBannerProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded text-xs border animate-fade-in mt-2 ${COLOR_MAP[toast.type]}`}>
      {ICON_MAP[toast.type]}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="ml-auto opacity-60 hover:opacity-100" aria-label="Fechar notificação">
        <X size={12} />
      </button>
    </div>
  );
};

export default ToastBanner;
