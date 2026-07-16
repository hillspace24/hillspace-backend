import { Module } from '@nestjs/common';
import { EscrowModule } from '../escrow/escrow.module';
import { ReportsController } from './reports.controller';

@Module({
  imports: [EscrowModule],
  controllers: [ReportsController],
})
export class ReportsModule {}
