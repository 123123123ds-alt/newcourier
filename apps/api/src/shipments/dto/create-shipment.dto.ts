import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

export class ShipmentPartyDto {
  @IsString()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @IsString()
  @MaxLength(256)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  postalCode?: string;
}

export class ShipmentItemDto {
  @IsString()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  hsCode?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unitWeightKg!: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  declaredValue!: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  originCountry?: string;
}

export class ShipmentExtraServiceDto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  value?: string;
}

export class CreateShipmentDto {
  @IsString()
  @MaxLength(64)
  referenceNo!: string;

  @IsString()
  @MaxLength(128)
  shippingMethod!: string;

  @IsString()
  @MaxLength(8)
  countryCode!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  weightKg!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  pieces!: number;

  @ValidateNested()
  @Type(() => ShipmentPartyDto)
  consignee!: ShipmentPartyDto;

  @ValidateNested()
  @Type(() => ShipmentPartyDto)
  shipper!: ShipmentPartyDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentItemDto)
  items!: ShipmentItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentExtraServiceDto)
  extraServices?: ShipmentExtraServiceDto[];

  @IsOptional()
  @IsString()
  @MaxLength(256)
  remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  labelType?: string;

  @IsOptional()
  @IsObject()
  additionalPayload?: Record<string, unknown>;
}
