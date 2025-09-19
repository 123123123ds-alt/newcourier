import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { parseStringPromise } from 'xml2js';
import { EccangResponse, NormalizedTrackingEvent } from './eccang.types';

const SOAP_NAMESPACE = 'http://tempuri.org/';

@Injectable()
export class EccangService {
  private readonly logger = new Logger(EccangService.name);
  private readonly endpoint: string;
  private readonly appToken: string;
  private readonly appKey: string;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService
  ) {
    this.endpoint = configService.get<string>('ECCANG_SERVICE_URL') ?? '';
    this.appToken = configService.get<string>('ECCANG_APP_TOKEN') ?? '';
    this.appKey = configService.get<string>('ECCANG_APP_KEY') ?? '';

    if (!this.endpoint || !this.appToken || !this.appKey) {
      this.logger.warn('ECCANG credentials are missing from environment variables');
    }
  }

  async createOrder<T = unknown>(params: unknown): Promise<EccangResponse<T>> {
    return this.callService<EccangResponse<T>>('createOrder', params);
  }

  async getTrackNumber<T = unknown>(params: unknown): Promise<EccangResponse<T>> {
    return this.callService<EccangResponse<T>>('getTrackNumber', params);
  }

  async getLabelUrl<T = unknown>(params: unknown): Promise<EccangResponse<T>> {
    return this.callService<EccangResponse<T>>('getLabelUrl', params);
  }

  async getCargoTrack<T = unknown>(params: unknown): Promise<EccangResponse<T>> {
    return this.callService<EccangResponse<T>>('getCargoTrack', params);
  }

  async cancelOrder<T = unknown>(params: unknown): Promise<EccangResponse<T>> {
    return this.callService<EccangResponse<T>>('cancelOrder', params);
  }

  async feeTrail<T = unknown>(params: unknown): Promise<EccangResponse<T>> {
    return this.callService<EccangResponse<T>>('feeTrail', params);
  }

  async getShippingMethod<T = unknown>(params: unknown): Promise<EccangResponse<T>> {
    return this.callService<EccangResponse<T>>('getShippingMethod', params);
  }

  async getExtraService<T = unknown>(params: unknown): Promise<EccangResponse<T>> {
    return this.callService<EccangResponse<T>>('getExtraService', params);
  }

  async getFieldRule<T = unknown>(params: unknown): Promise<EccangResponse<T>> {
    return this.callService<EccangResponse<T>>('getFieldRule', params);
  }

  async getCountry<T = unknown>(params: unknown): Promise<EccangResponse<T>> {
    return this.callService<EccangResponse<T>>('getCountry', params);
  }

  async getGoodstype<T = unknown>(params: unknown): Promise<EccangResponse<T>> {
    return this.callService<EccangResponse<T>>('getGoodstype', params);
  }

  async getReceivingExpense<T = unknown>(params: unknown): Promise<EccangResponse<T>> {
    return this.callService<EccangResponse<T>>('getReceivingExpense', params);
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
        typeof statusCandidate === 'string' ? statusCandidate : undefined,
      comment:
        typeof commentCandidate === 'string' ? commentCandidate : undefined,
      area: typeof areaCandidate === 'string' ? areaCandidate : undefined
    };
  }

  private async callService<T>(service: string, params: unknown): Promise<T> {
    if (!this.endpoint || !this.appToken || !this.appKey) {
      throw new ServiceUnavailableException('ECCANG credentials are not configured');
    }

    const envelope = this.buildEnvelope(service, params ?? {});

    try {
      const response$ = this.httpService.post(this.endpoint, envelope, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `${SOAP_NAMESPACE}callService`
        },
        timeout: 15000
      });

      const response = await lastValueFrom(response$);
      return await this.parseResponse<T>(response.data);
    } catch (error) {
      this.logger.error(`ECCANG call to ${service} failed`, error instanceof Error ? error.message : '');
      throw new ServiceUnavailableException('Unable to reach ECCANG service');
    }
  }

  private buildEnvelope(service: string, params: unknown): string {
    const paramsJson = JSON.stringify(params ?? {});

    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <callService xmlns="${SOAP_NAMESPACE}">
      <appToken>${this.escapeXml(this.appToken)}</appToken>
      <appKey>${this.escapeXml(this.appKey)}</appKey>
      <service>${this.escapeXml(service)}</service>
      <paramsJson>${this.escapeXml(paramsJson)}</paramsJson>
    </callService>
  </soap:Body>
</soap:Envelope>`;
  }

  private async parseResponse<T>(xml: string): Promise<T> {
    try {
      const parsed = await parseStringPromise(xml, {
        explicitArray: false,
        ignoreAttrs: false,
        trim: true
      });

      const envelope =
        parsed['soap:Envelope'] ?? parsed.Envelope ?? parsed['SOAP-ENV:Envelope'];
      const body =
        envelope?.['soap:Body'] ??
        envelope?.Body ??
        envelope?.['SOAP-ENV:Body'];
      const responseNode =
        body?.callServiceResponse ??
        body?.['ns1:callServiceResponse'] ??
        body?.['ns2:callServiceResponse'] ??
        body?.['soap:callServiceResponse'];

      const result =
        responseNode?.return ??
        responseNode?.CallServiceResult ??
        responseNode?.response ??
        responseNode;

      if (typeof result === 'string') {
        return JSON.parse(result) as T;
      }

      if (result && typeof result === 'object') {
        return result as T;
      }

      throw new Error('Unexpected response structure');
    } catch (error) {
      this.logger.error('Failed to parse ECCANG response', error instanceof Error ? error.message : '');
      throw new ServiceUnavailableException('Invalid response from ECCANG service');
    }
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
