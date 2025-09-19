import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SafeUser } from '../common/types/user.types';
import { EccangService } from '../eccang/eccang.service';
import { EccangResponse } from '../eccang/eccang.types';
import { PrismaService } from '../prisma/prisma.service';
import { ReportSummaryQueryDto } from './dto/report-summary-query.dto';

export interface ReportSummary {
  totalShipments: number;
  totalWeightKg: number;
  totalPieces: number;
  byStatus: Record<string, number>;
  totalFees: number;
}

interface CachedSummary {
  expiresAt: number;
  summary: ReportSummary;
}

const SUMMARY_CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly cache = new Map<string, CachedSummary>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eccangService: EccangService
  ) {}

  async getSummary(
    user: SafeUser,
    query: ReportSummaryQueryDto
  ): Promise<ReportSummary> {
    const cacheKey = this.buildCacheKey(user, query);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.summary;
    }

    const where: Parameters<typeof this.prisma.shipment.findMany>[0]['where'] = {};

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
      } else if (query.ownerId) {
        where.ownerId = query.ownerId;
      }
    } else {
      where.ownerId = user.id;
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

    const summary: ReportSummary = {
      totalShipments: shipments.length,
      totalWeightKg,
      totalPieces,
      byStatus,
      totalFees: 0
    };

    if (shipments.length > 0) {
      try {
        const expense = await this.eccangService.getReceivingExpense({
          start_date: query.startDate,
          end_date: query.endDate,
          reference_no: shipments.map((shipment) => shipment.referenceNo)
        });

        summary.totalFees = this.extractNumericTotal(expense);
      } catch (error) {
        this.logger.warn(
          `Failed to retrieve ECCANG receiving expense: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + SUMMARY_CACHE_TTL,
      summary
    });

    return summary;
  }

  private buildCacheKey(user: SafeUser, query: ReportSummaryQueryDto): string {
    return JSON.stringify({
      user: { id: user.id, role: user.role },
      query
    });
  }

  private extractNumericTotal(response: EccangResponse<unknown>): number {
    const fromData = this.findNumericValue(response?.data, [
      'totalFee',
      'total_fee',
      'total',
      'fee',
      'amount'
    ]);

    if (fromData !== undefined) {
      return fromData;
    }

    return (
      this.findNumericValue(response, [
        'totalFee',
        'total_fee',
        'total',
        'fee',
        'amount'
      ]) ?? 0
    );
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
