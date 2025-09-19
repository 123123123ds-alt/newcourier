import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SafeUser } from '../common/types/user.types';
import { ReportSummaryQueryDto } from './dto/report-summary-query.dto';
import { ReportSummary, ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  summary(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportSummaryQueryDto
  ): Promise<ReportSummary> {
    return this.reportsService.getSummary(user, query);
  }
}
