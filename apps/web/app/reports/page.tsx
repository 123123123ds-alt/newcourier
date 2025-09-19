'use client';

import { useEffect, useMemo, useState } from 'react';
import { DownloadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/components/providers/auth-provider';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/components/ui/use-toast';

interface ReportSummary {
  totalShipments: number;
  totalWeightKg: number;
  totalPieces: number;
  byStatus: Record<string, number>;
  totalFees: number;
}

export default function ReportsPage(): JSX.Element {
  const { auth } = useAuth();
  const { apiFetch } = useApi();
  const { toast } = useToast();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mineOnly, setMineOnly] = useState<'true' | 'false'>('true');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth?.role === 'ADMIN') {
      setMineOnly('false');
    }
  }, [auth?.role]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    setSummary(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (mineOnly === 'true') params.append('mine', 'true');

      const data = await apiFetch<ReportSummary>(`/reports/summary?${params.toString()}`);
      setSummary(data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Reports unavailable',
        description: error instanceof Error ? error.message : 'Failed to load ECCANG summary'
      });
    } finally {
      setLoading(false);
    }
  };

  const csvContent = useMemo(() => {
    if (!summary) {
      return '';
    }

    const lines = [
      ['Metric', 'Value'],
      ['Total shipments', summary.totalShipments.toString()],
      ['Total weight (kg)', summary.totalWeightKg.toString()],
      ['Total pieces', summary.totalPieces.toString()],
      ['Total fees', summary.totalFees.toString()],
      ...Object.entries(summary.byStatus).map(([status, count]) => [`Status: ${status}`, count.toString()])
    ];

    return lines.map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  }, [summary]);

  const handleExport = () => {
    if (!csvContent) {
      toast({
        variant: 'destructive',
        title: 'Nothing to export',
        description: 'Run a report before exporting CSV.'
      });
      return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `shipment-summary-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Generate per-user and global summaries directly from ECCANG.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Filter summary</CardTitle>
            <CardDescription>Select date range and ownership scope.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
              {auth?.role === 'ADMIN' ? (
                <div className="space-y-2">
                  <Label htmlFor="scope">Scope</Label>
                  <Select
                    id="scope"
                    value={mineOnly}
                    onChange={(event) => setMineOnly(event.target.value as 'true' | 'false')}
                  >
                    <option value="false">All users</option>
                    <option value="true">Only my shipments</option>
                  </Select>
                </div>
              ) : null}
              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Generating...' : 'Run report'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {summary ? (
          <Card className="mt-8">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Summary</CardTitle>
                <CardDescription>Aggregated totals with ECCANG receiving expense data.</CardDescription>
              </div>
              <Button variant="outline" onClick={handleExport}>
                <DownloadCloud className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-border p-4">
                  <p className="text-sm text-muted-foreground">Total shipments</p>
                  <p className="text-2xl font-semibold">{summary.totalShipments}</p>
                </div>
                <div className="rounded-md border border-border p-4">
                  <p className="text-sm text-muted-foreground">Total weight (kg)</p>
                  <p className="text-2xl font-semibold">{summary.totalWeightKg.toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border p-4">
                  <p className="text-sm text-muted-foreground">Total pieces</p>
                  <p className="text-2xl font-semibold">{summary.totalPieces}</p>
                </div>
                <div className="rounded-md border border-border p-4">
                  <p className="text-sm text-muted-foreground">Total fees</p>
                  <p className="text-2xl font-semibold">{summary.totalFees.toFixed(2)}</p>
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold">By status</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(summary.byStatus).map(([status, count]) => (
                      <TableRow key={status}>
                        <TableCell>{status}</TableCell>
                        <TableCell className="text-right">{count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
