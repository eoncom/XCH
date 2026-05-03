import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
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
import { NotificationService } from '../notifications/notification.service';
import { NotificationEventType } from '../notifications/notification-events';
import { HealthAggregationService } from './health-aggregation.service';
import { WorkerEventLogger } from '../../common/observability/worker-event-logger.service';

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
    private readonly notifications: NotificationService,
    private readonly aggregator: HealthAggregationService,
    private readonly events: WorkerEventLogger,
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
      include: {
        httpConfig: true,
        tenant: { select: { allowInternalNetworkTargets: true } },
        // Loaded so we can resolve the effective siteId for notification routing.
        asset: { select: { siteId: true } },
        link: { select: { siteId: true } },
      },
    });

    if (!check) {
      this.logger.warn(`probe ${checkId}: check not found (deleted?), dropping job`);
      return;
    }
    if (!check.enabled) {
      this.logger.debug(`probe ${checkId}: disabled, skipping`);
      return;
    }

    const allowInternal = check.tenant.allowInternalNetworkTargets;
    const result = await this.dispatchProbe(check, allowInternal);

    // Selective retry: if the error is transient AND we have attempts left,
    // throw to trigger exponential backoff. Otherwise persist as DOWN/UP.
    const transient = isTransientError(result);
    const attemptsLeft = (job.opts.attempts ?? 1) - job.attemptsMade - 1;
    if (transient && attemptsLeft > 0) {
      this.logger.debug(`probe ${checkId}: transient error (${result.error}) — retrying (${attemptsLeft} left)`);
      throw new Error(result.error || 'transient');
    }

    await this.persistResult(check, result);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    // Skip heartbeat noise — emitted every 60s, ~1440 events/day per worker.
    if (job.name === JOB_HEARTBEAT) return;
    const duration_ms = computeDurationMs(job);
    this.events.jobCompleted(
      MONITOR_QUEUE,
      String(job.id),
      job.name,
      duration_ms,
      job.attemptsMade + 1,
      { check_id: job.data?.checkId },
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    // BullMQ retries are normal flow control. We only emit a final structured
    // event when retries are exhausted — the retry attempts themselves are
    // visible in `attempts` field of the eventual completed/failed event.
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    const duration_ms = computeDurationMs(job);
    this.events.jobFailed(
      MONITOR_QUEUE,
      String(job.id),
      job.name,
      err,
      job.attemptsMade,
      { check_id: job.data?.checkId, duration_ms },
    );
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
    check: {
      id: string;
      tenantId: string;
      kind: MonitorKind;
      target: string;
      targetPort: number | null;
      siteId: string | null;
      asset: { siteId: string | null } | null;
      link: { siteId: string } | null;
      lastStatus: MonitorStatus;
    },
    result: ProbeResult,
  ): Promise<void> {
    const previousStatus = check.lastStatus;
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.monitorResult.create({
        data: {
          checkId: check.id,
          status: result.status,
          responseMs: result.responseMs,
          error: result.error,
          checkedAt: now,
        },
      }),
      this.prisma.monitorCheck.update({
        where: { id: check.id },
        data: {
          lastCheckedAt: now,
          lastStatus: result.status,
        },
      }),
    ]);

    if (previousStatus === result.status || previousStatus === MonitorStatus.UNKNOWN) {
      // No transition (or first probe ever) — nothing to alert on.
      return;
    }

    this.logger.log(
      `check ${check.id} transition ${previousStatus} → ${result.status}` +
        (result.error ? ` (${result.error})` : ''),
    );

    // Dispatch notification on UP↔DOWN transition. The router resolves the
    // delegation from siteId and applies the inherited config (ADR-009).
    const isDown = result.status === MonitorStatus.DOWN;
    const eventType = isDown ? NotificationEventType.MONITOR_DOWN : NotificationEventType.MONITOR_UP;
    const targetDisplay = check.targetPort ? `${check.target}:${check.targetPort}` : check.target;
    const effectiveSiteId =
      check.siteId ?? check.asset?.siteId ?? check.link?.siteId ?? undefined;

    const title = isDown
      ? `Monitor DOWN — ${targetDisplay}`
      : `Monitor rétabli — ${targetDisplay}`;
    const reason = result.error ? `\n\nRaison : ${result.error}` : '';
    const bodyText = `Le monitor ${check.kind} sur "${targetDisplay}" est passé ${previousStatus} → ${result.status}.${reason}`;
    const bodyHtml = `<p>Le monitor <strong>${check.kind}</strong> sur <code>${escapeHtml(targetDisplay)}</code> est passé <strong>${previousStatus} → ${result.status}</strong>.</p>${result.error ? `<p>Raison : <code>${escapeHtml(result.error)}</code></p>` : ''}`;

    // ADR-020 — async dispatch via the `notifications` queue. Returns
    // immediately ; processor handles fan-out + retry.
    this.notifications
      .queueDispatch({
        tenantId: check.tenantId,
        eventType,
        scopeContext: { siteId: effectiveSiteId },
        entity: { type: 'monitor', id: check.id, name: targetDisplay },
        title,
        bodyHtml,
        bodyText,
        actionUrl: `/dashboard/monitoring/${check.id}`,
      })
      .catch((e) => this.logger.warn(`notification enqueue failed: ${e.message}`));

    // ADR-016 — recompute Site.healthStatus in real-time on every transition.
    // The 5-min cron HealthSyncScheduler still runs as a safety net.
    if (effectiveSiteId) {
      this.aggregator
        .recomputeSite(effectiveSiteId)
        .catch((e) => this.logger.warn(`recomputeSite(${effectiveSiteId}) failed: ${e.message}`));
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isTransientError(result: ProbeResult): boolean {
  if (result.status !== MonitorStatus.DOWN || !result.error) return false;
  // Error format is `${code}: ${message}` — match the leading code token.
  const code = result.error.split(':')[0]?.trim();
  return TRANSIENT_ERROR_CODES.has(code);
}

/**
 * Wall-clock duration of a Bull job from its `processedOn` (set when the
 * worker picks it up) to now. Returns 0 if `processedOn` is missing —
 * Bull always sets it before invoking the handler so 0 only on edge
 * paths (sync error before pickup).
 */
function computeDurationMs(job: Job): number {
  if (!job.processedOn) return 0;
  return Math.max(0, Date.now() - job.processedOn);
}
