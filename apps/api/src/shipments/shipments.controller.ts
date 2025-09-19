import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { Shipment } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SafeUser } from '../common/types/user.types';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { LabelShipmentDto } from './dto/label-shipment.dto';
import { ShipmentReportQueryDto } from './dto/shipment-report-query.dto';
import { TrackShipmentDto } from './dto/track-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ShipmentWithEvents, ShipmentsService } from './shipments.service';

@Controller('shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  create(
    @CurrentUser() user: SafeUser,
    @Body() createShipmentDto: CreateShipmentDto
  ): Promise<Shipment> {
    return this.shipmentsService.create(user, createShipmentDto);
  }

  @Get()
  list(
    @CurrentUser() user: SafeUser,
    @Query('status') status?: string,
    @Query('ownerId') ownerId?: string
  ): Promise<Shipment[]> {
    return this.shipmentsService.findAll(user, status, ownerId);
  }

  @Get('report')
  report(
    @CurrentUser() user: SafeUser,
    @Query() query: ShipmentReportQueryDto
  ): Promise<{
    totalShipments: number;
    totalWeightKg: number;
    totalPieces: number;
    byStatus: Record<string, number>;
    totalFees: number;
  }> {
    return this.shipmentsService.report(user, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string
  ): Promise<ShipmentWithEvents> {
    return this.shipmentsService.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() updateShipmentDto: UpdateShipmentDto
  ): Promise<Shipment> {
    return this.shipmentsService.update(user, id, updateShipmentDto);
  }

  @Post(':id/label')
  requestLabel(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() labelShipmentDto: LabelShipmentDto
  ): Promise<Shipment> {
    return this.shipmentsService.requestLabel(user, id, labelShipmentDto);
  }

  @Post(':id/track')
  track(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() trackShipmentDto: TrackShipmentDto
  ): Promise<ShipmentWithEvents> {
    return this.shipmentsService.track(user, id, trackShipmentDto);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() cancelShipmentDto: CancelShipmentDto
  ): Promise<Shipment> {
    return this.shipmentsService.cancel(user, id, cancelShipmentDto);
  }
}
