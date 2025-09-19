import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class TrackShipmentQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIn(['order_code', 'reference_no', 'tracking_number'])
  type?: 'order_code' | 'reference_no' | 'tracking_number';

  @IsOptional()
  @IsString()
  @MaxLength(2)
  @IsIn(['EN', 'CN'])
  lang?: 'EN' | 'CN';
}
