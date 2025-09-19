import { Module } from '@nestjs/common';
import { EccangModule } from '../eccang/eccang.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';

@Module({
  imports: [PrismaModule, EccangModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService]
})
export class ShipmentsModule {}
