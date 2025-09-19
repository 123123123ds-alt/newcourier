import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { RootProviders } from '@/components/providers/root-providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans'
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'NewCourier';

export const metadata: Metadata = {
  title: appName,
  description: 'Create, track and manage shipments with ECCANG integration.'
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background font-sans antialiased', inter.variable)}>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
