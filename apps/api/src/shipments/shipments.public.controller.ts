import { Controller, Get, Query } from '@nestjs/common';
import { NormalizedTrackingEvent } from '../eccang/eccang.types';
import { TrackShipmentQueryDto } from './dto/track-shipment.dto';
import { ShipmentsService } from './shipments.service';

@Controller('shipments/search')
export class ShipmentsPublicController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get('track')
  trackByCode(
    @Query() query: TrackShipmentQueryDto
  ): Promise<{ code: string; events: NormalizedTrackingEvent[]; status: string }> {
    return this.shipmentsService.trackAnonymous(query);
  }
}
