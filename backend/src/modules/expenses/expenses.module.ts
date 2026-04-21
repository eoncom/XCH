import { Module, forwardRef } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { BudgetsModule } from '../budgets/budgets.module';

@Module({
  // forwardRef handles the fact that BudgetsController also imports
  // ExpensesService (via ExpensesModule exported in app). Budget↔Expense is
  // a bidirectional domain coupling by design — threshold alerts fire when
  // expenses change, and budget status reads expense aggregates.
  imports: [forwardRef(() => BudgetsModule)],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
