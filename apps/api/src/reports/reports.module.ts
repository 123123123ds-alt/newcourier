import { Module } from '@nestjs/common';
import { EccangModule } from '../eccang/eccang.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PrismaModule, EccangModule],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
