'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
).replace(/\/$/, '');

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const { login, auth } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: 'Invalid credentials' }));
        throw new Error(body?.message ?? 'Unable to log in');
      }

      const data = await response.json();
      login(data);
      toast({
        title: 'Welcome back',
        description: 'You have successfully signed in.'
      });
      router.replace('/dashboard');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: error instanceof Error ? error.message : 'Something went wrong'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth) {
      router.replace('/dashboard');
    }
  }, [auth, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>Access your NewCourier dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email" requiredMark>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" requiredMark>
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-6 text-xs text-muted-foreground">
            Default admin: <span className="font-medium">admin@newcourier.test / Password123!</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
