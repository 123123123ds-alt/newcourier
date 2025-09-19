'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';

export default function HomeRedirect(): JSX.Element {
  const router = useRouter();
  const { auth, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    router.replace(auth ? '/dashboard' : '/login');
  }, [auth, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading experience...
    </div>
  );
}
