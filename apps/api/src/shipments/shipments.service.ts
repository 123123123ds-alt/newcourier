import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { Prisma, Role, Shipment, TrackingEvent } from '@prisma/client';
import { SafeUser } from '../common/types/user.types';
import { EccangService } from '../eccang/eccang.service';
import { EccangResponse } from '../eccang/eccang.types';
import { PrismaService } from '../prisma/prisma.service';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { LabelShipmentDto } from './dto/label-shipment.dto';
import { ShipmentReportQueryDto } from './dto/shipment-report-query.dto';
import { TrackShipmentDto } from './dto/track-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

export type ShipmentWithEvents = Shipment & { events: TrackingEvent[] };

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eccangService: EccangService
  ) {}

  async create(owner: SafeUser, dto: CreateShipmentDto): Promise<Shipment> {
    const payload = {
      ...(dto.orderPayload ?? {}),
      reference_no: dto.referenceNo
    };

    let response: EccangResponse<Record<string, unknown>>;

    try {
      response = await this.eccangService.createOrder(payload);
    } catch (error) {
      this.logger.error('Failed to create order with ECCANG', error instanceof Error ? error.message : '');
      throw new BadGatewayException('Failed to create order with ECCANG');
    }

    const status = this.resolveStatus(response);
    const orderCode = this.findStringValue(response, [
      'orderCode',
      'order_code',
      'ordercode',
      'ordercode2',
      'order_code2',
      'code'
    ]);
    const trackingNumber = this.findStringValue(response, [
      'trackingNumber',
      'tracking_number',
      'trackingNo',
      'tracking_no',
      'track_no',
      'mailNo'
    ]);
    const labelUrl = this.findStringValue(response, ['labelUrl', 'label_url']);
    const invoiceUrl = this.findStringValue(response, ['invoiceUrl', 'invoice_url']);

    try {
      return await this.prisma.shipment.create({
        data: {
          ownerId: owner.id,
          referenceNo: dto.referenceNo,
          shippingMethod: dto.shippingMethod ?? null,
          countryCode: dto.countryCode ?? null,
          weightKg: dto.weightKg ?? null,
          pieces: dto.pieces ?? null,
          labelType: dto.labelType ?? null,
          status,
          orderCode: orderCode ?? null,
          trackingNumber: trackingNumber ?? null,
          labelUrl: labelUrl ?? null,
          invoiceUrl: invoiceUrl ?? null,
          rawRequest: this.mergeJsonField(null, 'createOrder', payload),
          rawResponse: this.mergeJsonField(null, 'createOrder', response)
        }
      });
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

  async findAll(
    requester: SafeUser,
    status?: string,
    ownerId?: string
  ): Promise<Shipment[]> {
    const where: Prisma.ShipmentWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (requester.role === Role.ADMIN) {
      if (ownerId) {
        where.ownerId = ownerId;
      }
    } else {
      where.ownerId = requester.id;
    }

    return this.prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(requester: SafeUser, id: string): Promise<ShipmentWithEvents> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        events: {
          orderBy: { occurredAt: 'desc' }
        }
      }
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    this.ensureCanAccess(requester, shipment);

    return shipment;
  }

  async update(
    requester: SafeUser,
    id: string,
    dto: UpdateShipmentDto
  ): Promise<Shipment> {
    const shipment = await this.getShipmentOrThrow(id);
    this.ensureCanAccess(requester, shipment);

    return this.prisma.shipment.update({
      where: { id },
      data: {
        shippingMethod: dto.shippingMethod ?? shipment.shippingMethod ?? null,
        countryCode: dto.countryCode ?? shipment.countryCode ?? null,
        weightKg: dto.weightKg ?? shipment.weightKg ?? null,
        pieces: dto.pieces ?? shipment.pieces ?? null,
        labelType: dto.labelType ?? shipment.labelType ?? null,
        status: dto.status ?? shipment.status,
        orderCode: dto.orderCode ?? shipment.orderCode ?? null,
        trackingNumber: dto.trackingNumber ?? shipment.trackingNumber ?? null
      }
    });
  }

  async requestLabel(
    requester: SafeUser,
    id: string,
    dto: LabelShipmentDto
  ): Promise<Shipment> {
    const shipment = await this.getShipmentOrThrow(id);
    this.ensureCanAccess(requester, shipment);

    const labelType = dto.labelType ?? shipment.labelType ?? 'PDF';

    let response: EccangResponse<Record<string, unknown>>;

    try {
      response = await this.eccangService.getLabelUrl({
        reference_no: shipment.referenceNo,
        label: labelType
      });
    } catch (error) {
      this.logger.error('Failed to fetch ECCANG label URL', error instanceof Error ? error.message : '');
      throw new BadGatewayException('Failed to retrieve label from ECCANG');
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

  async track(
    requester: SafeUser,
    id: string,
    dto: TrackShipmentDto
  ): Promise<ShipmentWithEvents> {
    const shipment = await this.getShipmentOrThrow(id, true);
    this.ensureCanAccess(requester, shipment);

    const code = dto.code ?? shipment.trackingNumber ?? shipment.referenceNo;

    if (!code) {
      throw new BadGatewayException('Tracking number is not available for this shipment');
    }

    const type = dto.type ?? 'tracking';

    let response: EccangResponse<unknown>;

    try {
      response = await this.eccangService.getCargoTrack({
        code,
        type
      });
    } catch (error) {
      this.logger.error('Failed to retrieve ECCANG tracking information', error instanceof Error ? error.message : '');
      throw new BadGatewayException('Failed to retrieve tracking information');
    }

    const events = this.eccangService.normalizeTrackingEvents(
      response.data ?? response
    );

    const transactions: Prisma.PrismaPromise<unknown>[] = [];

    if (events.length > 0) {
      transactions.push(
        this.prisma.trackingEvent.deleteMany({ where: { shipmentId: shipment.id } })
      );

      transactions.push(
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

    transactions.push(
      this.prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: this.findStringValue(response, ['status', 'track_status']) ??
            shipment.status,
          rawRequest: this.mergeJsonField(shipment.rawRequest, 'getCargoTrack', {
            code,
            type
          }),
          rawResponse: this.mergeJsonField(shipment.rawResponse, 'getCargoTrack', response)
        }
      })
    );

    await this.prisma.$transaction(transactions);

    return this.findOne(requester, shipment.id);
  }

  async cancel(
    requester: SafeUser,
    id: string,
    dto: CancelShipmentDto
  ): Promise<Shipment> {
    const shipment = await this.getShipmentOrThrow(id);
    this.ensureCanAccess(requester, shipment);

    const code = dto.code ?? shipment.orderCode ?? shipment.referenceNo;

    if (!code) {
      throw new BadGatewayException('Order code is not available for cancellation');
    }

    const type = dto.type ?? 'order';

    let response: EccangResponse<unknown>;

    try {
      response = await this.eccangService.cancelOrder({
        code,
        type
      });
    } catch (error) {
      this.logger.error('Failed to cancel ECCANG order', error instanceof Error ? error.message : '');
      throw new BadGatewayException('Failed to cancel shipment with ECCANG');
    }

    const isCancelled = this.isSuccessful(response);

    return this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: isCancelled ? 'CANCELLED' : shipment.status,
        rawRequest: this.mergeJsonField(shipment.rawRequest, 'cancelOrder', {
          code,
          type
        }),
        rawResponse: this.mergeJsonField(shipment.rawResponse, 'cancelOrder', response)
      }
    });
  }

  async report(
    requester: SafeUser,
    query: ShipmentReportQueryDto
  ): Promise<{
    totalShipments: number;
    totalWeightKg: number;
    totalPieces: number;
    byStatus: Record<string, number>;
    totalFees: number;
  }> {
    const where: Prisma.ShipmentWhereInput = {};

    if (requester.role === Role.ADMIN) {
      if (query.ownerId) {
        where.ownerId = query.ownerId;
      }
    } else {
      where.ownerId = requester.id;
    }

    const dateFilter: Prisma.DateTimeFilter = {};

    if (query.startDate) {
      dateFilter.gte = new Date(query.startDate);
    }

    if (query.endDate) {
      dateFilter.lte = new Date(query.endDate);
    }

    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }

    const shipments = await this.prisma.shipment.findMany({ where });

    const byStatus = shipments.reduce<Record<string, number>>((acc, shipment) => {
      acc[shipment.status] = (acc[shipment.status] ?? 0) + 1;
      return acc;
    }, {});

    const totalWeightKg = shipments.reduce(
      (sum, shipment) => sum + (shipment.weightKg ?? 0),
      0
    );
    const totalPieces = shipments.reduce(
      (sum, shipment) => sum + (shipment.pieces ?? 0),
      0
    );

    let totalFees = 0;

    if (shipments.length > 0) {
      try {
        const response = await this.eccangService.getReceivingExpense({
          start_date: query.startDate,
          end_date: query.endDate,
          reference_no: shipments.map((shipment) => shipment.referenceNo)
        });

        totalFees = this.extractNumericTotal(response);
      } catch (error) {
        this.logger.warn('Failed to retrieve ECCANG receiving expense', error instanceof Error ? error.message : '');
      }
    }

    return {
      totalShipments: shipments.length,
      totalWeightKg,
      totalPieces,
      byStatus,
      totalFees
    };
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

  private ensureCanAccess(user: SafeUser, shipment: Shipment): void {
    if (user.role === Role.ADMIN) {
      return;
    }

    if (shipment.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this shipment');
    }
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
    if (!response) {
      return 'CREATED';
    }

    const status = this.findStringValue(response, ['status', 'orderStatus']);

    if (status) {
      return status;
    }

    if (this.isSuccessful(response)) {
      return 'SUBMITTED';
    }

    return 'CREATED';
  }

  private isSuccessful(response: EccangResponse<unknown>): boolean {
    const ack = response.ack ?? response.ackCode ?? response.success ?? response.code;

    if (typeof ack === 'boolean') {
      return ack;
    }

    if (typeof ack === 'number') {
      return ack === 1;
    }

    if (typeof ack === 'string') {
      const normalized = ack.toLowerCase();
      return ['true', 'success', 'successful', 'ok', '1', '200'].includes(normalized);
    }

    return false;
  }

  private findStringValue(
    payload: unknown,
    keys: string[]
  ): string | undefined {
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

  private extractNumericTotal(response: EccangResponse<unknown>): number {
    const data = response?.data;

    const fromData = this.findNumericValue(data, [
      'totalFee',
      'total_fee',
      'total',
      'fee',
      'amount'
    ]);

    if (fromData !== undefined) {
      return fromData;
    }

    return this.findNumericValue(response, [
      'totalFee',
      'total_fee',
      'total',
      'fee',
      'amount'
    ]) ?? 0;
  }

  private findNumericValue(
    payload: unknown,
    keys: string[]
  ): number | undefined {
    if (!payload) {
      return undefined;
    }

    if (Array.isArray(payload)) {
      return payload
        .map((item) => this.findNumericValue(item, keys) ?? 0)
        .reduce((sum, value) => sum + value, 0);
    }

    if (typeof payload === 'object') {
      const record = payload as Record<string, unknown>;

      for (const key of keys) {
        const value = record[key];

        if (typeof value === 'number') {
          return value;
        }

        if (typeof value === 'string' && value.trim().length > 0) {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) {
            return parsed;
          }
        }
      }

      for (const value of Object.values(record)) {
        const numeric = this.findNumericValue(value, keys);
        if (numeric !== undefined) {
          return numeric;
        }
      }
    }

    return undefined;
  }
}
