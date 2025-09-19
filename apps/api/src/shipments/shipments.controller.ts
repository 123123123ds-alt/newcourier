import {
  Body,
  Controller,
  Get,
  Param,
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
import { LabelShipmentQueryDto } from './dto/label-shipment.dto';
import { ListShipmentsDto } from './dto/list-shipments.dto';
import { TrackShipmentQueryDto } from './dto/track-shipment.dto';
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
    @Query() query: ListShipmentsDto
  ): Promise<Shipment[]> {
    return this.shipmentsService.list(user, query);
  }

  @Get('meta/shipping-methods')
  shippingMethods(): Promise<unknown[]> {
    return this.shipmentsService.getShippingMethods();
  }

  @Get('meta/extra-services')
  extraServices(): Promise<unknown[]> {
    return this.shipmentsService.getExtraServices();
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string
  ): Promise<ShipmentWithEvents> {
    return this.shipmentsService.findOne(user, id);
  }

  @Get(':id/label')
  requestLabel(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Query() labelShipmentDto: LabelShipmentQueryDto
  ): Promise<Shipment> {
    return this.shipmentsService.getLabel(user, id, labelShipmentDto);
  }

  @Get(':id/track')
  track(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Query() trackShipmentDto: TrackShipmentQueryDto
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

  @Post('preview-fee')
  previewFee(
    @CurrentUser() user: SafeUser,
    @Body() dto: CreateShipmentDto
  ): Promise<unknown> {
    return this.shipmentsService.previewFees(user, dto);
  }
}
