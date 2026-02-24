import { useState, useCallback, useRef } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/**
 * Hook to replace window.confirm() with an inline dialog.
 * Usage:
 *   const { confirmState, confirm } = useConfirm();
 *   // in JSX: <ConfirmDialog state={confirmState} />
 *   // in handlers: const ok = await confirm({ title, message });
 */
export function useConfirm() {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const handleAnswer = useCallback((answer: boolean) => {
    resolveRef.current?.(answer);
    setConfirmState(null);
  }, []);

  return { confirmState, confirm, handleAnswer };
}
