import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class ReportSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = String(value).toLowerCase();
    return normalized === 'true' || normalized === '1';
  })
  @IsBoolean()
  mine?: boolean;

  @IsOptional()
  @IsString()
  ownerId?: string;
}
