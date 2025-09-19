'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react';

export type ToastVariant = 'default' | 'destructive';

export interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface Toast extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = options.id ?? generateId();
      const next: Toast = {
        id,
        title: options.title,
        description: options.description,
        variant: options.variant ?? 'default',
        duration: options.duration ?? 5000
      };

      setToasts((current) => [...current, next]);

      if (next.duration && next.duration > 0) {
        window.setTimeout(() => dismiss(id), next.duration);
      }

      return id;
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, toast, dismiss }),
    [toasts, toast, dismiss]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): Pick<ToastContextValue, 'toast' | 'dismiss'> {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return { toast: context.toast, dismiss: context.dismiss };
}

export function useToastState(): Toast[] {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToastState must be used within a ToastProvider');
  }

  return context.toasts;
}
