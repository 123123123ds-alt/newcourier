import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EccangClient } from './eccang.client';
import { EccangResponse, NormalizedTrackingEvent } from './eccang.types';

const STATUS_LABELS = new Map<string, string>([
  ['0', 'CREATED'],
  ['1', 'SUBMITTED'],
  ['2', 'AWAITING_TRACK_NUMBER'],
  ['3', 'LABEL_READY'],
  ['4', 'IN_TRANSIT'],
  ['5', 'DELIVERED'],
  ['6', 'EXCEPTION'],
  ['7', 'CANCELLED'],
  ['created', 'CREATED'],
  ['submitted', 'SUBMITTED'],
  ['waiting', 'AWAITING_TRACK_NUMBER'],
  ['pending', 'AWAITING_TRACK_NUMBER'],
  ['label_ready', 'LABEL_READY'],
  ['label', 'LABEL_READY'],
  ['in_transit', 'IN_TRANSIT'],
  ['transit', 'IN_TRANSIT'],
  ['delivered', 'DELIVERED'],
  ['exception', 'EXCEPTION'],
  ['cancelled', 'CANCELLED'],
  ['canceled', 'CANCELLED'],
  ['success', 'SUBMITTED']
]);

@Injectable()
export class EccangService {
  private readonly logger = new Logger(EccangService.name);
  private readonly client?: EccangClient;

  constructor(configService: ConfigService) {
    const baseUrl = configService.get<string>('ECCANG_SERVICE_URL');
    const appToken = configService.get<string>('ECCANG_APP_TOKEN');
    const appKey = configService.get<string>('ECCANG_APP_KEY');

    if (baseUrl && appToken && appKey) {
      this.client = new EccangClient(baseUrl, appToken, appKey);
    } else {
      this.logger.warn('ECCANG credentials are missing from environment variables');
    }
  }

  async createOrder(
    payload: Record<string, unknown>
  ): Promise<EccangResponse<Record<string, unknown>>> {
    return this.call<EccangResponse<Record<string, unknown>>>(
      'createOrder',
      payload
    );
  }

  async getTrackNumber(
    referenceNos: string[]
  ): Promise<EccangResponse<unknown>> {
    return this.call<EccangResponse<unknown>>('getTrackNumber', {
      reference_no: referenceNos
    });
  }

  async getLabelUrl(
    code: string,
    options?: Record<string, unknown>
  ): Promise<EccangResponse<unknown>> {
    return this.call<EccangResponse<unknown>>('getLabelUrl', {
      reference_no: code,
      ...(options ?? {})
    });
  }

  async cancelOrder(
    code: string,
    type: 'reference_no' | 'order_code' | 'tracking_number'
  ): Promise<EccangResponse<unknown>> {
    return this.call<EccangResponse<unknown>>('cancelOrder', {
      code,
      type
    });
  }

  async getCargoTrack(
    codes: string[],
    type: 'order_code' | 'reference_no' | 'tracking_number' = 'reference_no',
    lang: 'EN' | 'CN' = 'EN'
  ): Promise<EccangResponse<unknown>> {
    return this.call<EccangResponse<unknown>>('getCargoTrack', {
      code: codes,
      type,
      lang
    });
  }

  async feeTrail(
    params: Record<string, unknown>
  ): Promise<EccangResponse<unknown>> {
    return this.call<EccangResponse<unknown>>('feeTrail', params);
  }

  async getShippingMethod(
    params: Record<string, unknown> = {}
  ): Promise<EccangResponse<unknown>> {
    return this.call<EccangResponse<unknown>>('getShippingMethod', params);
  }

  async getExtraService(
    params: Record<string, unknown> = {}
  ): Promise<EccangResponse<unknown>> {
    return this.call<EccangResponse<unknown>>('getExtraService', params);
  }

  async getFieldRule(
    params: Record<string, unknown> = {}
  ): Promise<EccangResponse<unknown>> {
    return this.call<EccangResponse<unknown>>('getFieldRule', params);
  }

  async getCountry(): Promise<EccangResponse<unknown>> {
    return this.call<EccangResponse<unknown>>('getCountry', {});
  }

  async getGoodstype(): Promise<EccangResponse<unknown>> {
    return this.call<EccangResponse<unknown>>('getGoodstype', {});
  }

  async getReceivingExpense(
    params: Record<string, unknown>
  ): Promise<EccangResponse<unknown>> {
    return this.call<EccangResponse<unknown>>('getReceivingExpense', params);
  }

  mapStatus(input: unknown): string {
    if (typeof input === 'number') {
      return this.mapStatus(String(input));
    }

    if (typeof input !== 'string') {
      return 'CREATED';
    }

    const trimmed = input.trim();

    if (!trimmed) {
      return 'CREATED';
    }

    const normalized = trimmed.toLowerCase();
    const mapped = STATUS_LABELS.get(normalized) ?? STATUS_LABELS.get(trimmed);

    if (mapped) {
      return mapped;
    }

    return trimmed.toUpperCase();
  }

  isAskSuccess(response: EccangResponse<unknown>): boolean {
    const ack =
      response?.ack ??
      response?.ackCode ??
      response?.success ??
      response?.code ??
      response?.msg ??
      response?.message;

    if (typeof ack === 'boolean') {
      return ack;
    }

    if (typeof ack === 'number') {
      return ack === 1 || ack === 200;
    }

    if (typeof ack === 'string') {
      const normalized = ack.trim().toLowerCase();
      return ['success', 'true', 'ok', '1', '200'].includes(normalized);
    }

    return false;
  }

  normalizeTrackingEvents(payload: unknown): NormalizedTrackingEvent[] {
    if (!payload) {
      return [];
    }

    const rawEvents = this.extractEventArray(payload);

    return rawEvents
      .map((event) => this.mapTrackingEvent(event))
      .filter((event): event is NormalizedTrackingEvent => Boolean(event));
  }

  private extractEventArray(payload: unknown): any[] {
    if (!payload) {
      return [];
    }

    if (Array.isArray(payload)) {
      return payload;
    }

    if (typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;
      const candidateKeys = [
        'items',
        'item',
        'tracks',
        'track',
        'data',
        'list',
        'detail',
        'details'
      ];

      for (const key of candidateKeys) {
        const value = obj[key];
        if (Array.isArray(value)) {
          return value;
        }
      }
    }

    return [];
  }

  private mapTrackingEvent(raw: unknown): NormalizedTrackingEvent | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const record = raw as Record<string, unknown>;
    const occurredAtCandidate =
      record.occurredAt ??
      record.occurDate ??
      record.occur_date ??
      record.occur_time ??
      record.time ??
      record.trackTime ??
      record.track_time ??
      record.track_occur_date ??
      record.scantime ??
      record.scanTime ??
      record.scan_date ??
      record.eventTime ??
      record.dealDate ??
      record.operateDate ??
      record.created_at ??
      record['@time'];

    if (!occurredAtCandidate || typeof occurredAtCandidate !== 'string') {
      return null;
    }

    const occurredAt = new Date(occurredAtCandidate);

    if (Number.isNaN(occurredAt.getTime())) {
      return null;
    }

    const statusCandidate =
      record.status ??
      record.statusCode ??
      record.trackStatus ??
      record.track_status ??
      record.eventCode ??
      record.event_code ??
      record.code ??
      record['@status'];

    const commentCandidate =
      record.comment ??
      record.remark ??
      record.description ??
      record.trackDesc ??
      record.track_desc ??
      record.eventDescription ??
      record.event_des ??
      record.context ??
      record.info ??
      record.detail ??
      record.trackContent ??
      record.track_content;

    const areaCandidate =
      record.area ??
      record.location ??
      record.city ??
      record.site ??
      record.country ??
      record.position ??
      record.address;

    return {
      occurredAt,
      statusCode:
        typeof statusCandidate === 'string'
          ? this.mapStatus(statusCandidate)
          : undefined,
      comment:
        typeof commentCandidate === 'string' ? commentCandidate : undefined,
      area: typeof areaCandidate === 'string' ? areaCandidate : undefined
    };
  }

  private getClient(): EccangClient {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'ECCANG credentials are not configured'
      );
    }

    return this.client;
  }

  private async call<T>(service: string, params: unknown): Promise<T> {
    try {
      return await this.getClient().call<T>(service, params ?? {});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected ECCANG error';
      this.logger.error(`ECCANG call to ${service} failed: ${message}`);
      throw new ServiceUnavailableException(
        'Unable to reach ECCANG service'
      );
    }
  }
}
