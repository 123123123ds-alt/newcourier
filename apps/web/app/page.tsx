import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center">
      <div className="space-y-4">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
          Welcome to NewCourier
        </span>
        <h1 className="text-4xl font-bold sm:text-5xl">Manage your logistics in one place</h1>
        <p className="max-w-2xl text-muted-foreground">
          NewCourier helps admins and shippers create orders, track parcels, download labels and stay on top of
          delivery fees with a single integrated experience powered by the ECCANG platform.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/auth/register">Get started</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/docs">Read the docs</Link>
        </Button>
      </div>
    </main>
  );
}
