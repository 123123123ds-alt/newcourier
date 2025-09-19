import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy
} from '@nestjs/common';
import { Prisma, Role, Shipment, TrackingEvent } from '@prisma/client';
import { SafeUser } from '../common/types/user.types';
import { EccangService } from '../eccang/eccang.service';
import { EccangResponse, NormalizedTrackingEvent } from '../eccang/eccang.types';
import { PrismaService } from '../prisma/prisma.service';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';
import {
  CreateShipmentDto,
  ShipmentExtraServiceDto,
  ShipmentItemDto,
  ShipmentPartyDto
} from './dto/create-shipment.dto';
import { LabelShipmentDto, LabelShipmentQueryDto } from './dto/label-shipment.dto';
import { ListShipmentsDto } from './dto/list-shipments.dto';
import { TrackShipmentDto, TrackShipmentQueryDto } from './dto/track-shipment.dto';

export type ShipmentWithEvents = Shipment & { events: TrackingEvent[] };

const TRACK_NUMBER_POLL_INTERVAL = 10_000; // 10 seconds
const TRACK_NUMBER_POLL_ATTEMPTS = 12; // 2 minutes

@Injectable()
export class ShipmentsService implements OnModuleDestroy {
  private readonly logger = new Logger(ShipmentsService.name);
  private readonly pollers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eccangService: EccangService
  ) {}

  onModuleDestroy(): void {
    this.clearPollers();
  }

  async create(owner: SafeUser, dto: CreateShipmentDto): Promise<Shipment> {
    const payload = this.buildCreateOrderPayload(dto);

    let response: EccangResponse<Record<string, unknown>>;

    try {
      response = await this.eccangService.createOrder(payload);
    } catch (error) {
      this.logger.error(
        'Failed to create order with ECCANG',
        error instanceof Error ? error.message : ''
      );
      throw new BadGatewayException('Failed to create order with ECCANG');
    }

    if (!this.eccangService.isAskSuccess(response)) {
      throw new BadGatewayException(
        this.extractMessage(response) ?? 'ECCANG rejected createOrder request'
      );
    }

    const status = this.resolveStatus(response);
    const orderCode = this.findStringValue(response, [
      'orderCode',
      'order_code',
      'orderNo',
      'order_no',
      'code'
    ]);
    const trackingNumber = this.findStringValue(response, [
      'trackingNumber',
      'tracking_number',
      'trackingNo',
      'tracking_no',
      'mailNo',
      'logisticsNo'
    ]);
    const labelUrl = this.findStringValue(response, ['labelUrl', 'label_url']);
    const invoiceUrl = this.findStringValue(response, ['invoiceUrl', 'invoice_url']);
    const trackStatus = this.findStringValue(response, [
      'track_status',
      'trackStatus',
      'status'
    ]);
    const labelType = dto.labelType ?? 'PDF';

    try {
      const shipment = await this.prisma.shipment.create({
        data: {
          ownerId: owner.id,
          referenceNo: dto.referenceNo,
          shippingMethod: dto.shippingMethod,
          countryCode: dto.countryCode,
          weightKg: dto.weightKg,
          pieces: dto.pieces,
          labelType,
          status,
          orderCode: orderCode ?? null,
          trackingNumber: trackingNumber ?? null,
          labelUrl: labelUrl ?? null,
          invoiceUrl: invoiceUrl ?? null,
          rawRequest: this.mergeJsonField(null, 'createOrder', payload),
          rawResponse: this.mergeJsonField(null, 'createOrder', response)
        }
      });

      if (!trackingNumber && this.shouldPollForTrackNumber(trackStatus)) {
        this.enqueueTrackNumberPoll(shipment.id, shipment.referenceNo);
      }

      return shipment;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A shipment with this reference already exists');
      }

      throw error;
    }
  }

  async list(user: SafeUser, query: ListShipmentsDto): Promise<Shipment[]> {
    const where: Prisma.ShipmentWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    if (user.role === Role.ADMIN) {
      if (query.mine) {
        where.ownerId = user.id;
      }
    } else {
      where.ownerId = user.id;
    }

    return this.prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(user: SafeUser, id: string): Promise<ShipmentWithEvents> {
    const shipment = await this.getShipmentOrThrow(id, true);
    this.ensureCanAccess(user, shipment);

    return shipment;
  }

  async getShippingMethods(): Promise<unknown[]> {
    try {
      const response = await this.eccangService.getShippingMethod({});

      if (!this.eccangService.isAskSuccess(response)) {
        throw new BadGatewayException(
          this.extractMessage(response) ?? 'ECCANG rejected getShippingMethod request'
        );
      }

      return this.extractArray(response.data ?? response);
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      this.logger.error(
        'Failed to load ECCANG shipping methods',
        error instanceof Error ? error.message : ''
      );
      throw new BadGatewayException('Failed to load shipping methods from ECCANG');
    }
  }

  async getExtraServices(): Promise<unknown[]> {
    try {
      const response = await this.eccangService.getExtraService({});

      if (!this.eccangService.isAskSuccess(response)) {
        throw new BadGatewayException(
          this.extractMessage(response) ?? 'ECCANG rejected getExtraService request'
        );
      }

      return this.extractArray(response.data ?? response);
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      this.logger.error(
        'Failed to load ECCANG extra services',
        error instanceof Error ? error.message : ''
      );
      throw new BadGatewayException('Failed to load extra services from ECCANG');
    }
  }

  async previewFees(
    _user: SafeUser,
    dto: CreateShipmentDto
  ): Promise<unknown> {
    // Allow both admins and users to reuse their shipment payload for previews
    const payload = this.buildCreateOrderPayload(dto);

    try {
      const response = await this.eccangService.feeTrail(payload);

      if (!this.eccangService.isAskSuccess(response)) {
        throw new BadGatewayException(
          this.extractMessage(response) ?? 'ECCANG rejected feeTrail request'
        );
      }

      return response.data ?? response;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      this.logger.error(
        'Failed to preview ECCANG fees',
        error instanceof Error ? error.message : ''
      );
      throw new BadGatewayException('Failed to preview shipment fees');
    }
  }

  async getLabel(
    user: SafeUser,
    id: string,
    query: LabelShipmentQueryDto
  ): Promise<Shipment> {
    const shipment = await this.getShipmentOrThrow(id);
    this.ensureCanAccess(user, shipment);

    const labelType = query.labelType ?? shipment.labelType ?? 'PDF';

    let response: EccangResponse<unknown>;

    try {
      response = await this.eccangService.getLabelUrl(shipment.referenceNo, {
        label: labelType
      });
    } catch (error) {
      this.logger.error(
        'Failed to retrieve ECCANG label',
        error instanceof Error ? error.message : ''
      );
      throw new BadGatewayException('Failed to retrieve label from ECCANG');
    }

    if (!this.eccangService.isAskSuccess(response)) {
      throw new BadGatewayException(
        this.extractMessage(response) ?? 'ECCANG rejected getLabelUrl request'
      );
    }

    const labelUrl = this.findStringValue(response, ['labelUrl', 'label_url']);
    const invoiceUrl = this.findStringValue(response, ['invoiceUrl', 'invoice_url']);

    return this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        labelType,
        labelUrl: labelUrl ?? shipment.labelUrl ?? null,
        invoiceUrl: invoiceUrl ?? shipment.invoiceUrl ?? null,
        rawRequest: this.mergeJsonField(shipment.rawRequest, 'getLabelUrl', {
          reference_no: shipment.referenceNo,
          label: labelType
        }),
        rawResponse: this.mergeJsonField(shipment.rawResponse, 'getLabelUrl', response)
      }
    });
  }

  async requestLabel(
    user: SafeUser,
    id: string,
    dto: LabelShipmentDto
  ): Promise<Shipment> {
    return this.getLabel(user, id, dto);
  }

  async cancel(
    user: SafeUser,
    id: string,
    dto: CancelShipmentDto
  ): Promise<Shipment> {
    const shipment = await this.getShipmentOrThrow(id);
    this.ensureCanAccess(user, shipment);

    const code =
      dto.code ?? shipment.orderCode ?? shipment.referenceNo ?? shipment.trackingNumber;

    if (!code) {
      throw new BadGatewayException('Order code is not available for cancellation');
    }

    const type: 'reference_no' | 'order_code' | 'tracking_number' =
      dto.type ??
      (shipment.orderCode
        ? 'order_code'
        : shipment.trackingNumber
        ? 'tracking_number'
        : 'reference_no');

    let response: EccangResponse<unknown>;

    try {
      response = await this.eccangService.cancelOrder(code, type);
    } catch (error) {
      this.logger.error(
        'Failed to cancel ECCANG order',
        error instanceof Error ? error.message : ''
      );
      throw new BadGatewayException('Failed to cancel shipment with ECCANG');
    }

    if (!this.eccangService.isAskSuccess(response)) {
      throw new BadGatewayException(
        this.extractMessage(response) ?? 'ECCANG rejected cancelOrder request'
      );
    }

    return this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: 'CANCELLED',
        rawRequest: this.mergeJsonField(shipment.rawRequest, 'cancelOrder', {
          code,
          type
        }),
        rawResponse: this.mergeJsonField(shipment.rawResponse, 'cancelOrder', response)
      }
    });
  }

  async track(
    user: SafeUser,
    id: string,
    query: TrackShipmentQueryDto
  ): Promise<ShipmentWithEvents> {
    const shipment = await this.getShipmentOrThrow(id, true);
    this.ensureCanAccess(user, shipment);

    const code =
      query.code ??
      shipment.trackingNumber ??
      shipment.orderCode ??
      shipment.referenceNo;

    if (!code) {
      throw new BadGatewayException(
        'Tracking number or reference code is not available for this shipment'
      );
    }

    const type: 'order_code' | 'reference_no' | 'tracking_number' =
      query.type ??
      (shipment.trackingNumber
        ? 'tracking_number'
        : shipment.orderCode
        ? 'order_code'
        : 'reference_no');
    const lang: 'EN' | 'CN' = query.lang ?? 'EN';

    let response: EccangResponse<unknown>;

    try {
      response = await this.eccangService.getCargoTrack([code], type, lang);
    } catch (error) {
      this.logger.error(
        'Failed to retrieve ECCANG tracking information',
        error instanceof Error ? error.message : ''
      );
      throw new BadGatewayException('Failed to retrieve tracking information');
    }

    if (!this.eccangService.isAskSuccess(response)) {
      throw new BadGatewayException(
        this.extractMessage(response) ?? 'ECCANG rejected getCargoTrack request'
      );
    }

    const events = this.eccangService.normalizeTrackingEvents(
      response?.data ?? response
    );
    const status = this.resolveStatus(response) ?? shipment.status;

    const operations: Prisma.PrismaPromise<unknown>[] = [];

    operations.push(
      this.prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status,
          rawRequest: this.mergeJsonField(shipment.rawRequest, 'getCargoTrack', {
            code,
            type,
            lang
          }),
          rawResponse: this.mergeJsonField(shipment.rawResponse, 'getCargoTrack', response)
        }
      })
    );

    if (events.length > 0) {
      operations.push(
        this.prisma.trackingEvent.deleteMany({ where: { shipmentId: shipment.id } })
      );

      operations.push(
        this.prisma.trackingEvent.createMany({
          data: events.map((event) => ({
            shipmentId: shipment.id,
            occurredAt: event.occurredAt,
            statusCode: event.statusCode ?? null,
            comment: event.comment ?? null,
            area: event.area ?? null
          }))
        })
      );
    }

    await this.prisma.$transaction(operations);

    return this.findOne(user, shipment.id);
  }

  async trackViaBody(
    user: SafeUser,
    id: string,
    dto: TrackShipmentDto
  ): Promise<ShipmentWithEvents> {
    return this.track(user, id, dto);
  }

  async trackAnonymous(
    query: TrackShipmentQueryDto
  ): Promise<{ code: string; events: NormalizedTrackingEvent[]; status: string }> {
    if (!query.code) {
      throw new BadGatewayException('Tracking code is required');
    }

    const type = query.type ?? 'tracking_number';
    const lang = query.lang ?? 'EN';

    try {
      const response = await this.eccangService.getCargoTrack([query.code], type, lang);

      if (!this.eccangService.isAskSuccess(response)) {
        throw new BadGatewayException(
          this.extractMessage(response) ?? 'ECCANG rejected getCargoTrack request'
        );
      }

      const events = this.eccangService.normalizeTrackingEvents(response.data ?? response);
      return {
        code: query.code,
        events,
        status: this.resolveStatus(response)
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      this.logger.error(
        'Failed to perform anonymous ECCANG tracking',
        error instanceof Error ? error.message : ''
      );
      throw new BadGatewayException('Failed to retrieve tracking information');
    }
  }

  private buildCreateOrderPayload(dto: CreateShipmentDto): Record<string, unknown> {
    return {
      reference_no: dto.referenceNo,
      shipping_method: dto.shippingMethod,
      country_code: dto.countryCode,
      weight: dto.weightKg,
      pieces: dto.pieces,
      consignee: this.normalizeParty(dto.consignee),
      shipper: this.normalizeParty(dto.shipper),
      items: dto.items.map((item) => this.normalizeItem(item)),
      extra_services: dto.extraServices?.map((service) =>
        this.normalizeExtraService(service)
      ),
      remark: dto.remarks,
      label: dto.labelType ?? 'PDF',
      ...(dto.additionalPayload ?? {})
    };
  }

  private normalizeParty(party: ShipmentPartyDto): Record<string, unknown> {
    return {
      name: party.name,
      company: party.company,
      phone: party.phone,
      email: party.email,
      country: party.country,
      province: party.province,
      city: party.city,
      address_line1: party.addressLine1,
      address_line2: party.addressLine2,
      postal_code: party.postalCode
    };
  }

  private normalizeItem(item: ShipmentItemDto): Record<string, unknown> {
    return {
      name: item.name,
      sku: item.sku,
      hs_code: item.hsCode,
      quantity: item.quantity,
      unit_weight: item.unitWeightKg,
      declared_value: item.declaredValue,
      origin_country: item.originCountry
    };
  }

  private normalizeExtraService(
    service: ShipmentExtraServiceDto
  ): Record<string, unknown> {
    return {
      code: service.code,
      value: service.value
    };
  }

  private ensureCanAccess(user: SafeUser, shipment: Shipment): void {
    if (user.role === Role.ADMIN) {
      return;
    }

    if (shipment.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this shipment');
    }
  }

  private async getShipmentOrThrow(
    id: string,
    includeEvents = false
  ): Promise<Shipment | ShipmentWithEvents> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: includeEvents
        ? {
            events: {
              orderBy: { occurredAt: 'desc' }
            }
          }
        : undefined
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    return shipment as ShipmentWithEvents | Shipment;
  }

  private mergeJsonField(
    current: unknown,
    key: string,
    value: unknown
  ): Record<string, unknown> {
    const base: Record<string, unknown> =
      current && typeof current === 'object' && !Array.isArray(current)
        ? { ...(current as Record<string, unknown>) }
        : {};

    base[key] = value;
    return base;
  }

  private resolveStatus(response: EccangResponse<unknown>): string {
    const statusCandidate =
      this.findStringValue(response, ['track_status', 'trackStatus', 'status']) ??
      this.findStringValue(response?.data, [
        'track_status',
        'trackStatus',
        'status'
      ]);

    if (statusCandidate) {
      return this.eccangService.mapStatus(statusCandidate);
    }

    if (this.eccangService.isAskSuccess(response)) {
      return 'SUBMITTED';
    }

    return 'CREATED';
  }

  private shouldPollForTrackNumber(status?: string): boolean {
    if (!status) {
      return false;
    }

    const normalized = this.eccangService.mapStatus(status);
    return ['AWAITING_TRACK_NUMBER', 'LABEL_READY'].includes(normalized);
  }

  private enqueueTrackNumberPoll(shipmentId: string, referenceNo: string): void {
    const executePoll = async (attempt: number): Promise<void> => {
      if (attempt > TRACK_NUMBER_POLL_ATTEMPTS) {
        this.pollers.delete(shipmentId);
        return;
      }

      try {
        const response = await this.eccangService.getTrackNumber([referenceNo]);

        if (this.eccangService.isAskSuccess(response)) {
          const trackingNumber = this.findStringValue(response, [
            'trackingNumber',
            'tracking_number',
            'trackingNo',
            'tracking_no',
            'mailNo'
          ]);
          const orderCode = this.findStringValue(response, [
            'orderCode',
            'order_code',
            'orderNo',
            'order_no',
            'code'
          ]);

          if (trackingNumber || orderCode) {
            const shipment = await this.prisma.shipment.findUnique({
              where: { id: shipmentId }
            });

            if (shipment) {
              await this.prisma.shipment.update({
                where: { id: shipmentId },
                data: {
                  trackingNumber: trackingNumber ?? shipment.trackingNumber ?? null,
                  orderCode: orderCode ?? shipment.orderCode ?? null,
                  status: this.resolveStatus(response),
                  rawRequest: this.mergeJsonField(
                    shipment.rawRequest,
                    'getTrackNumber',
                    {
                      reference_no: [referenceNo]
                    }
                  ),
                  rawResponse: this.mergeJsonField(
                    shipment.rawResponse,
                    'getTrackNumber',
                    response
                  )
                }
              });
            }

            this.pollers.delete(shipmentId);
            return;
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to poll ECCANG track number: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }

      this.replacePoller(
        shipmentId,
        setTimeout(() => {
          void executePoll(attempt + 1);
        }, TRACK_NUMBER_POLL_INTERVAL)
      );
    };

    this.replacePoller(
      shipmentId,
      setTimeout(() => {
        void executePoll(1);
      }, TRACK_NUMBER_POLL_INTERVAL)
    );
  }

  private replacePoller(id: string, handle: NodeJS.Timeout): void {
    const existing = this.pollers.get(id);
    if (existing) {
      clearTimeout(existing);
    }

    this.pollers.set(id, handle);
  }

  private clearPollers(): void {
    for (const handle of this.pollers.values()) {
      clearTimeout(handle);
    }

    this.pollers.clear();
  }

  private extractArray(payload: unknown): unknown[] {
    if (!payload) {
      return [];
    }

    if (Array.isArray(payload)) {
      return payload;
    }

    if (typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      const candidateKeys = [
        'items',
        'item',
        'data',
        'list',
        'rows',
        'methods',
        'services',
        'shippingMethods',
        'results'
      ];

      for (const key of candidateKeys) {
        const value = record[key];
        if (Array.isArray(value)) {
          return value;
        }
      }

      for (const value of Object.values(record)) {
        if (Array.isArray(value)) {
          return value;
        }
      }
    }

    return [];
  }

  private findStringValue(
    payload: unknown,
    keys: string[]
  ): string | undefined {
    if (!payload) {
      return undefined;
    }

    if (typeof payload === 'string') {
      return payload;
    }

    const queue: unknown[] = [payload];

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current || typeof current !== 'object') {
        continue;
      }

      const record = current as Record<string, unknown>;

      for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          return value;
        }
      }

      for (const value of Object.values(record)) {
        if (value && typeof value === 'object') {
          queue.push(value);
        }
      }
    }

    return undefined;
  }

  private extractMessage(response: EccangResponse<unknown>): string | undefined {
    return (
      this.findStringValue(response, ['message', 'msg', 'errorMessage']) ??
      this.findStringValue(response?.data, ['message', 'msg', 'errorMessage'])
    );
  }
}
