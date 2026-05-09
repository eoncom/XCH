import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { WorkerEventLogger } from '../../common/observability/worker-event-logger.service';

export const TEST_ERROR_QUEUE = 'test-error';
export const JOB_THROW = 'throw';

/**
 * Test-error processor — consume `throw` jobs en levant systématiquement
 * une erreur. Sert à valider le chemin observabilité worker → GlitchTip
 * (item 6 / critère acceptance v2.1.0).
 *
 * Retry policy : volontairement `attempts: 1` au moment de l'enqueue
 * (côté controller) — un test = un event Sentry, pas 3 retries qui
 * polluent la UI.
 */
@Processor(TEST_ERROR_QUEUE)
export class TestErrorProcessor {
  private readonly logger = new Logger(TestErrorProcessor.name);

  constructor(private readonly workerEventLogger: WorkerEventLogger) {}

  @Process(JOB_THROW)
  async throw(job: Job<{ message?: string; code?: string }>): Promise<never> {
    const { message = 'TestErrorProcessor synthetic failure', code } = job.data || {};
    const err = new Error(code ? `${code}: ${message}` : message);
    // Toujours router via WorkerEventLogger.jobFailed pour rester aligné avec
    // la convention worker → Loki + Sentry. attempts forcé à 1 (pas de retry
    // pertinent sur un test synthétique).
    this.workerEventLogger.jobFailed(
      TEST_ERROR_QUEUE,
      String(job.id),
      job.name,
      err,
      job.attemptsMade + 1,
    );
    throw err;
  }
}
