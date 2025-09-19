'use client';

import { useEffect, useMemo, useState } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileDown, RefreshCcw, ShieldX, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers/auth-provider';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/components/ui/use-toast';

interface TrackingEvent {
  id: string;
  occurredAt: string;
  statusCode?: string;
  comment?: string;
  area?: string;
}

interface ShipmentDetail {
  id: string;
  referenceNo: string;
  shippingMethod: string | null;
  status: string;
  trackingNumber: string | null;
  orderCode: string | null;
  labelType: string | null;
  labelUrl: string | null;
  invoiceUrl: string | null;
  createdAt: string;
  updatedAt: string;
  rawResponse?: Record<string, unknown> | null;
  events: TrackingEvent[];
}

export default function ShipmentDetailPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { auth, loading: authLoading } = useAuth();
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const shipmentId = params?.id;

  useEffect(() => {
    if (!auth && !authLoading) {
      router.replace('/login');
    }
  }, [auth, authLoading, router]);

  useEffect(() => {
    const loadShipment = async () => {
      if (!shipmentId) {
        notFound();
        return;
      }

      try {
        setLoading(true);
        const detail = await apiFetch<ShipmentDetail>(`/shipments/${shipmentId}`);
        setShipment(detail);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Shipment unavailable',
          description: error instanceof Error ? error.message : 'Failed to load shipment'
        });
      } finally {
        setLoading(false);
      }
    };

    if (auth && shipmentId) {
      void loadShipment();
    }
  }, [apiFetch, auth, shipmentId, toast]);

  const events = useMemo(() => {
    if (!shipment) {
      return [];
    }

    return [...shipment.events].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
  }, [shipment]);

  const handleRefreshTracking = async () => {
    if (!shipmentId) {
      return;
    }

    setActionLoading(true);

    try {
      const detail = await apiFetch<ShipmentDetail>(`/shipments/${shipmentId}/track`);
      setShipment(detail);
      toast({
        title: 'Tracking updated',
        description: 'Latest ECCANG tracking events have been synced.'
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Unable to refresh tracking',
        description: error instanceof Error ? error.message : 'ECCANG tracking unavailable'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetrieveLabel = async () => {
    if (!shipmentId) {
      return;
    }

    setActionLoading(true);

    try {
      const detail = await apiFetch<ShipmentDetail>(`/shipments/${shipmentId}/label`);
      setShipment(detail);
      toast({
        title: 'Label ready',
        description: 'The latest label and invoice links have been saved.'
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Label retrieval failed',
        description: error instanceof Error ? error.message : 'ECCANG label service unavailable'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelShipment = async () => {
    if (!shipmentId) {
      return;
    }

    setActionLoading(true);

    try {
      const detail = await apiFetch<ShipmentDetail>(`/shipments/${shipmentId}/cancel`, {
        method: 'POST'
      });
      setShipment(detail);
      toast({
        title: 'Shipment cancelled',
        description: 'ECCANG has acknowledged the cancellation request.'
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Cancellation failed',
        description: error instanceof Error ? error.message : 'ECCANG cancellation failed'
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (!shipmentId) {
    notFound();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading shipment...
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Shipment not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Shipment {shipment.referenceNo}</h1>
            <p className="text-muted-foreground">
              {shipment.shippingMethod ?? 'Unknown method'} · Created {new Date(shipment.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={shipment.status === 'CANCELLED' ? 'destructive' : 'secondary'}>
              {shipment.status}
            </Badge>
            {shipment.trackingNumber ? (
              <Badge variant="outline">Tracking: {shipment.trackingNumber}</Badge>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" /> Tracking timeline
                </CardTitle>
                <CardDescription>Latest events returned from ECCANG.</CardDescription>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tracking events yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {events.map((event) => (
                      <li key={event.id} className="rounded-md border border-border p-3">
                        <p className="text-sm font-semibold">
                          {new Date(event.occurredAt).toLocaleString()}{' '}
                          {event.area ? <span className="text-muted-foreground">· {event.area}</span> : null}
                        </p>
                        <p className="text-sm text-foreground">{event.statusCode ?? 'Status update'}</p>
                        {event.comment ? (
                          <p className="text-sm text-muted-foreground">{event.comment}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Interact with ECCANG services for this shipment.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" variant="secondary" disabled={actionLoading} onClick={handleRetrieveLabel}>
                  <FileDown className="mr-2 h-4 w-4" />
                  {actionLoading ? 'Processing...' : 'Get latest label'}
                </Button>
                <Button className="w-full" variant="outline" disabled={actionLoading} onClick={handleRefreshTracking}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Refresh tracking
                </Button>
                <Button className="w-full" variant="ghost" disabled={actionLoading} onClick={handleCancelShipment}>
                  <ShieldX className="mr-2 h-4 w-4" /> Cancel shipment
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Label preview</CardTitle>
                <CardDescription>Embed of the ECCANG label when available.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {shipment.labelUrl ? (
                  <div className="space-y-2">
                    <object
                      data={shipment.labelUrl}
                      type="application/pdf"
                      className="h-80 w-full rounded-md border border-border"
                    >
                      <p className="text-sm text-muted-foreground">
                        PDF preview unsupported. <Link href={shipment.labelUrl}>Download label</Link>
                      </p>
                    </object>
                    <div className="flex flex-col gap-2 text-sm">
                      <Link className="text-primary underline" href={shipment.labelUrl} target="_blank" rel="noopener">
                        Download label
                      </Link>
                      {shipment.invoiceUrl ? (
                        <Link className="text-primary underline" href={shipment.invoiceUrl} target="_blank" rel="noopener">
                          Download invoice
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No label generated yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
