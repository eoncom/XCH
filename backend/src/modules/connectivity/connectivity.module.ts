import { Module } from '@nestjs/common';
import { ConnectivityService } from './connectivity.service';
import { ConnectivityController } from './connectivity.controller';
import { ExpensesModule } from '../expenses/expenses.module';
import { MonitorsApiModule } from '../monitoring/monitors-api.module';

@Module({
  // ADR-011: ConnectivityController calls ExpensesService.resyncExpense
  // ADR-016: ConnectivityService.update calls MonitorReactionsService.autoSyncTargetForLink
  imports: [ExpensesModule, MonitorsApiModule],
  controllers: [ConnectivityController],
  providers: [ConnectivityService],
  exports: [ConnectivityService],
})
export class ConnectivityModule {}
