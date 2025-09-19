import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EccangService } from './eccang.service';

@Module({
  imports: [HttpModule],
  providers: [EccangService],
  exports: [EccangService]
})
export class EccangModule {}
