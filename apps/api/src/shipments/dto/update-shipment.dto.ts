import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from 'class-validator';

export class UpdateShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  shippingMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pieces?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  labelType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  orderCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  trackingNumber?: string;
}
