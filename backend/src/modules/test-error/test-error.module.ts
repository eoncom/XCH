import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ObservabilityModule } from '../../common/observability/observability.module';
import { TestErrorController } from './test-error.controller';
import { TestErrorProcessor } from './test-error.processor';
import { TEST_ERROR_QUEUE } from './test-error.processor';

/**
 * Module test-error — endpoints + processor pour valider la chaîne
 * GlitchTip (item 6 / critère acceptance v2.1.0).
 *
 * Importé par AppModule (où le controller live et enqueue les jobs) ET
 * par WorkerModule (où le processor consomme et throw). Bull dédoublonne
 * automatiquement la Queue côté Redis.
 *
 * Comme `ObservabilityModule` est `@Global` mais doit être explicitement
 * réimporté pour la self-containment dans WorkerModule (cf
 * XCH_NESTJS_GLOBAL_MODULE_TRAP), on le déclare ici aussi pour que le
 * processor puisse injecter `WorkerEventLogger`.
 */
@Module({
  imports: [BullModule.registerQueue({ name: TEST_ERROR_QUEUE }), ObservabilityModule],
  controllers: [TestErrorController],
  providers: [TestErrorProcessor],
})
export class TestErrorModule {}
