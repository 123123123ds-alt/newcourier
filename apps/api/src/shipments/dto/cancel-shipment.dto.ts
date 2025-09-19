import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIn(['reference_no', 'order_code', 'tracking_number'])
  type?: 'reference_no' | 'order_code' | 'tracking_number';
}
