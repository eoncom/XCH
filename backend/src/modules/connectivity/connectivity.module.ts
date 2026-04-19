import { Module } from '@nestjs/common';
import { ConnectivityService } from './connectivity.service';
import { ConnectivityController } from './connectivity.controller';
import { ExpensesModule } from '../expenses/expenses.module';

@Module({
  // ADR-011: ConnectivityController calls ExpensesService.resyncExpense
  imports: [ExpensesModule],
  controllers: [ConnectivityController],
  providers: [ConnectivityService],
  exports: [ConnectivityService],
})
export class ConnectivityModule {}
