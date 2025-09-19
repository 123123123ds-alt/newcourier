'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast, useToastState } from './use-toast';

export function Toaster(): JSX.Element | null {
  const toasts = useToastState();
  const { dismiss } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex flex-col items-center space-y-2 px-4 sm:items-end sm:px-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'w-full max-w-sm rounded-lg border border-border bg-background p-4 shadow-lg transition-all',
            toast.variant === 'destructive' && 'border-destructive/20 bg-destructive text-destructive-foreground'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
              {toast.description ? (
                <p className="text-sm text-muted-foreground">
                  {toast.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
              onClick={() => dismiss(toast.id)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
