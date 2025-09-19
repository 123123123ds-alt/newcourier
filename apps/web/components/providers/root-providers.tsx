'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from './auth-provider';
import { ToastProvider } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';

export function RootProviders({ children }: { children: ReactNode }): JSX.Element {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
        <Toaster />
      </ToastProvider>
    </AuthProvider>
  );
}
