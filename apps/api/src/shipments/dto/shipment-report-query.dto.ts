import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class ShipmentReportQueryDto {
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}
