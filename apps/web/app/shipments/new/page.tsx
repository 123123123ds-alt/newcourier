'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/providers/auth-provider';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/components/ui/use-toast';

interface ShipmentPartyForm {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  country?: string;
  province?: string;
  city?: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode?: string;
}

interface ShipmentItemForm {
  name: string;
  sku?: string;
  quantity: number;
  unitWeightKg: number;
  declaredValue: number;
  hsCode?: string;
  originCountry?: string;
}

interface ExtraServiceOption {
  code: string;
  name: string;
}

interface FeePreview {
  totalFee?: number;
  currency?: string;
  [key: string]: unknown;
}

function createEmptyParty(): ShipmentPartyForm {
  return {
    name: '',
    company: '',
    phone: '',
    email: '',
    country: '',
    province: '',
    city: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: ''
  };
}

function createEmptyItem(): ShipmentItemForm {
  return {
    name: '',
    sku: '',
    quantity: 1,
    unitWeightKg: 0.1,
    declaredValue: 1,
    hsCode: '',
    originCountry: ''
  };
}

interface ShippingMethodOption {
  code: string;
  label: string;
}

function parseShippingMethods(payload: unknown): ShippingMethodOption[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const code =
        (record.code as string) ??
        (record.method_code as string) ??
        (record.shipping_method_code as string) ??
        (record.methodCode as string) ??
        (record.channel_code as string);
      const name =
        (record.name as string) ??
        (record.shipping_method as string) ??
        (record.method_name as string) ??
        (record.channel_name as string) ??
        code;

      if (!code || !name) {
        return null;
      }

      return { code, label: name };
    })
    .filter((value): value is ShippingMethodOption => Boolean(value));
}

function parseExtraServices(payload: unknown): ExtraServiceOption[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const code = (record.code as string) ?? (record.serviceCode as string);
      const name =
        (record.name as string) ??
        (record.service_name as string) ??
        (record.description as string) ??
        code;

      if (!code) {
        return null;
      }

      return { code, name };
    })
    .filter((value): value is ExtraServiceOption => Boolean(value));
}

export default function NewShipmentPage(): JSX.Element {
  const router = useRouter();
  const { auth, loading: authLoading } = useAuth();
  const { apiFetch } = useApi();
  const { toast } = useToast();

  const [referenceNo, setReferenceNo] = useState('');
  const [shippingMethod, setShippingMethod] = useState('');
  const [shippingMethods, setShippingMethods] = useState<ShippingMethodOption[]>([]);
  const [extraServices, setExtraServices] = useState<ExtraServiceOption[]>([]);
  const [selectedExtraServices, setSelectedExtraServices] = useState<string[]>([]);
  const [countryCode, setCountryCode] = useState('');
  const [weightKg, setWeightKg] = useState(0.5);
  const [pieces, setPieces] = useState(1);
  const [labelType, setLabelType] = useState('PDF');
  const [remarks, setRemarks] = useState('');
  const [consignee, setConsignee] = useState<ShipmentPartyForm>(createEmptyParty());
  const [shipper, setShipper] = useState<ShipmentPartyForm>(createEmptyParty());
  const [items, setItems] = useState<ShipmentItemForm[]>([createEmptyItem()]);
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!auth && !authLoading) {
      router.replace('/login');
    }
  }, [auth, authLoading, router]);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [methods, services] = await Promise.all([
          apiFetch<unknown[]>('/shipments/meta/shipping-methods'),
          apiFetch<unknown[]>('/shipments/meta/extra-services')
        ]);
        setShippingMethods(parseShippingMethods(methods));
        setExtraServices(parseExtraServices(services));
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Metadata unavailable',
          description: error instanceof Error ? error.message : 'Failed to load ECCANG metadata'
        });
      }
    };

    if (auth) {
      void loadMetadata();
    }
  }, [apiFetch, auth, toast]);

  const handlePartyChange = (
    updater: typeof setConsignee | typeof setShipper,
    key: keyof ShipmentPartyForm,
    value: string
  ) => {
    updater((current) => ({ ...current, [key]: value }));
  };

  const handleItemChange = <K extends keyof ShipmentItemForm>(
    index: number,
    key: K,
    value: ShipmentItemForm[K]
  ) => {
    setItems((current) => {
      const copy = [...current];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems((current) => [...current, createEmptyItem()]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((current) => current.filter((_, idx) => idx !== index));
  };

  const buildPayload = () => ({
    referenceNo,
    shippingMethod,
    countryCode,
    weightKg,
    pieces,
    labelType,
    remarks,
    consignee,
    shipper,
    items: items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitWeightKg: Number(item.unitWeightKg),
      declaredValue: Number(item.declaredValue)
    })),
    extraServices: selectedExtraServices.map((code) => ({ code })),
    additionalPayload: {}
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFeePreview(null);

    try {
      const payload = buildPayload();
      const shipment = await apiFetch<{ id: string }>(`/shipments`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      toast({
        title: 'Shipment created',
        description: `Reference ${referenceNo} successfully submitted.`
      });
      router.push(`/shipments/${shipment.id}`);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create shipment',
        description: error instanceof Error ? error.message : 'Unexpected error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreviewFees = async () => {
    setPreviewLoading(true);
    setFeePreview(null);

    try {
      const payload = buildPayload();
      const result = await apiFetch<FeePreview>(`/shipments/preview-fee`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setFeePreview(result);
      toast({
        title: 'Fee preview ready',
        description: 'ECCANG returned the latest fee trail information.'
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fee preview failed',
        description: error instanceof Error ? error.message : 'ECCANG could not calculate fees'
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">New shipment</h1>
          <p className="text-muted-foreground">Submit order details to ECCANG and generate shipping documents.</p>
        </div>
        <form className="space-y-8" onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Shipment details</CardTitle>
              <CardDescription>Basic information used for label generation and tracking.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reference" requiredMark>
                  Reference number
                </Label>
                <Input
                  id="reference"
                  value={referenceNo}
                  onChange={(event) => setReferenceNo(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shippingMethod" requiredMark>
                  Shipping method
                </Label>
                <Select
                  id="shippingMethod"
                  value={shippingMethod}
                  onChange={(event) => setShippingMethod(event.target.value)}
                  required
                >
                  <option value="">Select a method</option>
                  {shippingMethods.map((method) => (
                    <option key={method.code} value={method.code}>
                      {method.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country" requiredMark>
                  Destination country code
                </Label>
                <Input
                  id="country"
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
                  placeholder="CN, US, GB..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight" requiredMark>
                  Total weight (kg)
                </Label>
                <Input
                  id="weight"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={weightKg}
                  onChange={(event) => setWeightKg(Number(event.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pieces" requiredMark>
                  Pieces
                </Label>
                <Input
                  id="pieces"
                  type="number"
                  min="1"
                  step="1"
                  value={pieces}
                  onChange={(event) => setPieces(Number(event.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="labelType">Label type</Label>
                <Select
                  id="labelType"
                  value={labelType}
                  onChange={(event) => setLabelType(event.target.value)}
                >
                  <option value="PDF">PDF</option>
                  <option value="PNG">PNG</option>
                  <option value="ZPL">ZPL</option>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Optional notes for ECCANG"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consignee</CardTitle>
              <CardDescription>Recipient contact and address information.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="consignee-name" requiredMark>
                  Name
                </Label>
                <Input
                  id="consignee-name"
                  value={consignee.name}
                  onChange={(event) => handlePartyChange(setConsignee, 'name', event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consignee-phone">Phone</Label>
                <Input
                  id="consignee-phone"
                  value={consignee.phone ?? ''}
                  onChange={(event) => handlePartyChange(setConsignee, 'phone', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consignee-email">Email</Label>
                <Input
                  id="consignee-email"
                  type="email"
                  value={consignee.email ?? ''}
                  onChange={(event) => handlePartyChange(setConsignee, 'email', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consignee-country" requiredMark>
                  Country
                </Label>
                <Input
                  id="consignee-country"
                  value={consignee.country ?? ''}
                  onChange={(event) => handlePartyChange(setConsignee, 'country', event.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consignee-province">Province/State</Label>
                <Input
                  id="consignee-province"
                  value={consignee.province ?? ''}
                  onChange={(event) => handlePartyChange(setConsignee, 'province', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consignee-city" requiredMark>
                  City
                </Label>
                <Input
                  id="consignee-city"
                  value={consignee.city ?? ''}
                  onChange={(event) => handlePartyChange(setConsignee, 'city', event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="consignee-address" requiredMark>
                  Address line 1
                </Label>
                <Input
                  id="consignee-address"
                  value={consignee.addressLine1}
                  onChange={(event) => handlePartyChange(setConsignee, 'addressLine1', event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="consignee-address2">Address line 2</Label>
                <Input
                  id="consignee-address2"
                  value={consignee.addressLine2 ?? ''}
                  onChange={(event) => handlePartyChange(setConsignee, 'addressLine2', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consignee-postal">Postal code</Label>
                <Input
                  id="consignee-postal"
                  value={consignee.postalCode ?? ''}
                  onChange={(event) => handlePartyChange(setConsignee, 'postalCode', event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipper</CardTitle>
              <CardDescription>Origin contact details used for customs declarations.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shipper-name" requiredMark>
                  Name
                </Label>
                <Input
                  id="shipper-name"
                  value={shipper.name}
                  onChange={(event) => handlePartyChange(setShipper, 'name', event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipper-phone">Phone</Label>
                <Input
                  id="shipper-phone"
                  value={shipper.phone ?? ''}
                  onChange={(event) => handlePartyChange(setShipper, 'phone', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipper-email">Email</Label>
                <Input
                  id="shipper-email"
                  type="email"
                  value={shipper.email ?? ''}
                  onChange={(event) => handlePartyChange(setShipper, 'email', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipper-country" requiredMark>
                  Country
                </Label>
                <Input
                  id="shipper-country"
                  value={shipper.country ?? ''}
                  onChange={(event) => handlePartyChange(setShipper, 'country', event.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipper-province">Province/State</Label>
                <Input
                  id="shipper-province"
                  value={shipper.province ?? ''}
                  onChange={(event) => handlePartyChange(setShipper, 'province', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipper-city" requiredMark>
                  City
                </Label>
                <Input
                  id="shipper-city"
                  value={shipper.city ?? ''}
                  onChange={(event) => handlePartyChange(setShipper, 'city', event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="shipper-address" requiredMark>
                  Address line 1
                </Label>
                <Input
                  id="shipper-address"
                  value={shipper.addressLine1}
                  onChange={(event) => handlePartyChange(setShipper, 'addressLine1', event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="shipper-address2">Address line 2</Label>
                <Input
                  id="shipper-address2"
                  value={shipper.addressLine2 ?? ''}
                  onChange={(event) => handlePartyChange(setShipper, 'addressLine2', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipper-postal">Postal code</Label>
                <Input
                  id="shipper-postal"
                  value={shipper.postalCode ?? ''}
                  onChange={(event) => handlePartyChange(setShipper, 'postalCode', event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>Provide a detailed declaration for customs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label requiredMark htmlFor={`item-name-${index}`}>
                      Item name
                    </Label>
                    <Input
                      id={`item-name-${index}`}
                      value={item.name}
                      onChange={(event) => handleItemChange(index, 'name', event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`item-sku-${index}`}>SKU</Label>
                    <Input
                      id={`item-sku-${index}`}
                      value={item.sku ?? ''}
                      onChange={(event) => handleItemChange(index, 'sku', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label requiredMark htmlFor={`item-quantity-${index}`}>
                      Quantity
                    </Label>
                    <Input
                      id={`item-quantity-${index}`}
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(event) => handleItemChange(index, 'quantity', Number(event.target.value))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label requiredMark htmlFor={`item-weight-${index}`}>
                      Unit weight (kg)
                    </Label>
                    <Input
                      id={`item-weight-${index}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.unitWeightKg}
                      onChange={(event) => handleItemChange(index, 'unitWeightKg', Number(event.target.value))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label requiredMark htmlFor={`item-value-${index}`}>
                      Declared value
                    </Label>
                    <Input
                      id={`item-value-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.declaredValue}
                      onChange={(event) => handleItemChange(index, 'declaredValue', Number(event.target.value))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`item-hs-${index}`}>HS code</Label>
                    <Input
                      id={`item-hs-${index}`}
                      value={item.hsCode ?? ''}
                      onChange={(event) => handleItemChange(index, 'hsCode', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`item-origin-${index}`}>Origin country</Label>
                    <Input
                      id={`item-origin-${index}`}
                      value={item.originCountry ?? ''}
                      onChange={(event) => handleItemChange(index, 'originCountry', event.target.value.toUpperCase())}
                    />
                  </div>
                  {items.length > 1 ? (
                    <div className="flex items-end justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={handleAddItem}>
                <Plus className="mr-2 h-4 w-4" /> Add another item
              </Button>
            </CardContent>
          </Card>

          {extraServices.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Extra services</CardTitle>
                <CardDescription>Select optional ECCANG services to bundle with your shipment.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {extraServices.map((service) => {
                  const checked = selectedExtraServices.includes(service.code);
                  return (
                    <label key={service.code} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-muted-foreground">Code: {service.code}</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={(event) => {
                          setSelectedExtraServices((current) => {
                            if (event.target.checked) {
                              return [...current, service.code];
                            }

                            return current.filter((code) => code !== service.code);
                          });
                        }}
                      />
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Button type="button" variant="outline" onClick={handlePreviewFees} disabled={previewLoading || submitting}>
                {previewLoading ? 'Calculating fees...' : 'Preview ECCANG fees'}
              </Button>
              {feePreview ? (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <p className="font-semibold">Fee preview</p>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-muted-foreground">
                    {JSON.stringify(feePreview, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {submitting ? 'Submitting shipment...' : 'Create shipment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
