import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  type?: string;
}
