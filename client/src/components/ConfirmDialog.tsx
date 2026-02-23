import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: boolean) => void;
}

interface ConfirmDialogProps {
  state: ConfirmState | null;
  onAnswer: (answer: boolean) => void;
}

/**
 * Inline confirmation dialog (replaces window.confirm()).
 * Pair with the useConfirm hook.
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ state, onAnswer }) => {
  if (!state) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className="text-warning shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-base mb-1">{state.title}</h3>
            <p className="text-sm text-muted">{state.message}</p>
          </div>
          <button
            className="btn-icon ml-auto"
            onClick={() => onAnswer(false)}
            aria-label="Cancelar"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => onAnswer(false)}
          >
            {state.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onAnswer(true)}
          >
            {state.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
