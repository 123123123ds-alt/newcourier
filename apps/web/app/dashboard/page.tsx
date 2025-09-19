'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, PackageSearch, PlusCircle, ReceiptText, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/components/providers/auth-provider';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/components/ui/use-toast';

interface Shipment {
  id: string;
  referenceNo: string;
  shippingMethod: string | null;
  status: string;
  trackingNumber: string | null;
  createdAt: string;
}

export default function DashboardPage(): JSX.Element {
  const router = useRouter();
  const { auth, loading: authLoading, logout } = useAuth();
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth && !authLoading) {
      router.replace('/login');
    }
  }, [auth, authLoading, router]);

  useEffect(() => {
    if (!auth) {
      return;
    }

    const fetchShipments = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<Shipment[]>(`/shipments?mine=true`);
        setShipments(data);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Unable to load shipments',
          description: error instanceof Error ? error.message : 'Unexpected error'
        });
        if (error instanceof Error && error.message.includes('Session')) {
          logout();
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchShipments();
  }, [apiFetch, auth, logout, router, toast]);

  const stats = useMemo(() => {
    const summary = shipments.reduce<Record<string, number>>((acc, shipment) => {
      const key = shipment.status ?? 'UNKNOWN';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return summary;
  }, [shipments]);

  if (!auth && authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Checking session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Create shipments, manage labels and review performance.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" asChild>
              <Link href="/shipments/new">
                <PlusCircle className="mr-2 h-4 w-4" /> New shipment
              </Link>
            </Button>
            <Button variant="outline" onClick={() => router.refresh()}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total shipments</CardDescription>
              <CardTitle>{shipments.length}</CardTitle>
            </CardHeader>
          </Card>
          {Object.entries(stats).map(([status, count]) => (
            <Card key={status}>
              <CardHeader className="pb-2">
                <CardDescription>{status}</CardDescription>
                <CardTitle>{count}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5" />
                Create shipment
              </CardTitle>
              <CardDescription>Prepare a new ECCANG order with automatic label handling.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" asChild>
                <Link href="/shipments/new">
                  Start new shipment <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageSearch className="h-5 w-5" />
                Track shipment
              </CardTitle>
              <CardDescription>Lookup tracking events without leaving your workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" asChild>
                <Link href="/track">
                  Open tracker <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5" />
                Reports
              </CardTitle>
              <CardDescription>Analyse totals, statuses and fees across your shipments.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary" asChild>
                <Link href="/reports">
                  View reports <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent shipments</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/shipments/new">Create shipment</Link>
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Loading shipments...
                      </TableCell>
                    </TableRow>
                  ) : shipments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No shipments yet. Create your first shipment to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    shipments.slice(0, 10).map((shipment) => (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-medium">{shipment.referenceNo}</TableCell>
                        <TableCell>{shipment.shippingMethod ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={shipment.status === 'CANCELLED' ? 'destructive' : 'secondary'}>
                            {shipment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{shipment.trackingNumber ?? 'Pending'}</TableCell>
                        <TableCell>{new Date(shipment.createdAt).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/shipments/${shipment.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
