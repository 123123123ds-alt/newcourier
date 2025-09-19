import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min
} from 'class-validator';

export class CreateShipmentDto {
  @IsString()
  @MaxLength(64)
  referenceNo!: string;

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
  @IsPositive()
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
  @IsObject()
  orderPayload?: Record<string, unknown>;
}
