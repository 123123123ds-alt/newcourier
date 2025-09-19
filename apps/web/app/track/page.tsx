'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface TrackingEvent {
  occurredAt: string;
  statusCode?: string;
  comment?: string;
  area?: string;
}

interface TrackingResponse {
  code: string;
  status: string;
  events: TrackingEvent[];
}

export default function TrackPage(): JSX.Element {
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [type, setType] = useState<'tracking_number' | 'order_code' | 'reference_no'>('tracking_number');
  const [results, setResults] = useState<TrackingResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!code) {
      toast({
        variant: 'destructive',
        title: 'Tracking code required',
        description: 'Enter a reference, order or tracking number to continue.'
      });
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const query = new URLSearchParams({ code, type }).toString();
      const response = await apiFetch<TrackingResponse>(`/shipments/search/track?${query}`);
      setResults(response);
      toast({
        title: 'Tracking retrieved',
        description: 'Latest ECCANG events are shown below.'
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Tracking failed',
        description: error instanceof Error ? error.message : 'ECCANG did not return results'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Track shipment</CardTitle>
            <CardDescription>Lookup ECCANG tracking data by order code, reference or tracking number.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-[2fr,1fr,auto]" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="code" requiredMark>
                  Tracking code
                </Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Enter tracking number or reference"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  id="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as typeof type)}
                >
                  <option value="tracking_number">Tracking number</option>
                  <option value="order_code">Order code</option>
                  <option value="reference_no">Reference number</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Checking...' : 'Track'}
                </Button>
              </div>
            </form>
            {results ? (
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Code</p>
                    <p className="font-semibold">{results.code}</p>
                  </div>
                  <Badge variant={results.status === 'CANCELLED' ? 'destructive' : 'secondary'}>
                    {results.status}
                  </Badge>
                </div>
                {results.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tracking events yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {results.events.map((event, index) => (
                      <li key={`${event.occurredAt}-${index}`} className="rounded-md border border-border p-3">
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
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
