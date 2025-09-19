import { Module } from '@nestjs/common';
import { EccangService } from './eccang.service';

@Module({
  providers: [EccangService],
  exports: [EccangService]
})
export class EccangModule {}
