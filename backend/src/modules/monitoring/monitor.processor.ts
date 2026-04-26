import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  PrismaClient,
  MonitorKind,
  MonitorStatus,
} from '@prisma/client';
import { TcpProbe } from './probes/tcp.probe';
import { HttpProbe } from './probes/http.probe';
import { IcmpProbe } from './probes/icmp.probe';
import { ProbeResult } from './probes/probe.types';
import { MonitorWorkerHealthService } from './monitor-worker-health.service';
import {
  MONITOR_QUEUE,
  JOB_PROBE,
  JOB_HEARTBEAT,
} from './monitor.scheduler';

const TRANSIENT_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNRESET',
  'EHOSTUNREACH',
]);

/**
 * Consumes the `monitor-check` BullMQ queue. Two job names:
 *   - JOB_PROBE     : run the appropriate probe, write a MonitorResult,
 *                     update lastStatus + lastCheckedAt on the check.
 *                     Notification dispatch on UP↔DOWN transition is wired
 *                     in lot 8 (extends the existing transition detection).
 *   - JOB_HEARTBEAT : touch /tmp/xch-worker-consumer-alive — proves the
 *                     consumer is decoded from Redis (ADR-014 §6).
 *
 * Selective retry: when the probe error matches a transient network code
 * (ENOTFOUND, ECONNREFUSED, …) the processor THROWS to trigger BullMQ's
 * exponential backoff (3 attempts). On the final attempt OR for a
 * legitimate non-transient DOWN, it persists the result and returns.
 */
@Processor(MONITOR_QUEUE)
export class MonitorProcessor {
  private readonly logger = new Logger(MonitorProcessor.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly tcpProbe: TcpProbe,
    private readonly httpProbe: HttpProbe,
    private readonly icmpProbe: IcmpProbe,
    private readonly health: MonitorWorkerHealthService,
  ) {}

  @Process(JOB_HEARTBEAT)
  async handleHeartbeat() {
    await this.health.touchConsumer();
  }

  @Process(JOB_PROBE)
  async handleProbe(job: Job<{ checkId: string }>) {
    const { checkId } = job.data;
    const check = await this.prisma.monitorCheck.findUnique({
      where: { id: checkId },
      include: { httpConfig: true, tenant: { select: { allowInternalMonitorTargets: true } } },
    });

    if (!check) {
      this.logger.warn(`probe ${checkId}: check not found (deleted?), dropping job`);
      return;
    }
    if (!check.enabled) {
      this.logger.debug(`probe ${checkId}: disabled, skipping`);
      return;
    }

    const allowInternal = check.tenant.allowInternalMonitorTargets;
    const result = await this.dispatchProbe(check, allowInternal);

    // Selective retry: if the error is transient AND we have attempts left,
    // throw to trigger exponential backoff. Otherwise persist as DOWN/UP.
    const transient = isTransientError(result);
    const attemptsLeft = (job.opts.attempts ?? 1) - job.attemptsMade - 1;
    if (transient && attemptsLeft > 0) {
      this.logger.debug(`probe ${checkId}: transient error (${result.error}) — retrying (${attemptsLeft} left)`);
      throw new Error(result.error || 'transient');
    }

    await this.persistResult(check.id, check.lastStatus, result);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    // BullMQ retries are normal flow control here — only log the final fail.
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      this.logger.warn(`job ${job.id} (${job.name}) exhausted retries: ${err.message}`);
    }
  }

  private async dispatchProbe(
    check: { kind: MonitorKind; target: string; targetPort: number | null; httpConfig: any },
    allowInternal: boolean,
  ): Promise<ProbeResult> {
    switch (check.kind) {
      case MonitorKind.TCP:
        if (check.targetPort == null) {
          return { status: MonitorStatus.DOWN, responseMs: null, error: 'TCP probe missing targetPort' };
        }
        return this.tcpProbe.probe(check.target, check.targetPort, allowInternal);
      case MonitorKind.HTTP:
        return this.httpProbe.probe(check.target, check.httpConfig ?? null, allowInternal);
      case MonitorKind.ICMP:
        return this.icmpProbe.probe(check.target, allowInternal);
      default:
        return { status: MonitorStatus.DOWN, responseMs: null, error: `unknown kind ${check.kind}` };
    }
  }

  private async persistResult(
    checkId: string,
    previousStatus: MonitorStatus,
    result: ProbeResult,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.monitorResult.create({
        data: {
          checkId,
          status: result.status,
          responseMs: result.responseMs,
          error: result.error,
          checkedAt: now,
        },
      }),
      this.prisma.monitorCheck.update({
        where: { id: checkId },
        data: {
          lastCheckedAt: now,
          lastStatus: result.status,
        },
      }),
    ]);

    // Status transition detection — notification dispatch added in lot 8.
    if (previousStatus !== result.status && previousStatus !== MonitorStatus.UNKNOWN) {
      this.logger.log(
        `check ${checkId} transition ${previousStatus} → ${result.status}` +
          (result.error ? ` (${result.error})` : ''),
      );
    }
  }
}

function isTransientError(result: ProbeResult): boolean {
  if (result.status !== MonitorStatus.DOWN || !result.error) return false;
  // Error format is `${code}: ${message}` — match the leading code token.
  const code = result.error.split(':')[0]?.trim();
  return TRANSIENT_ERROR_CODES.has(code);
}
