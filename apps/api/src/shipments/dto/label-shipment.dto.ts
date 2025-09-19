import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LabelShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  labelType?: string;
}
