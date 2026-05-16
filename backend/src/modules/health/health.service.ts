import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as net from 'net';

export type ProbeStatus = 'up' | 'down';

export interface ProbeResult {
  status: ProbeStatus;
  latencyMs: number;
  error?: string;
}

export interface HealthSnapshot {
  status: 'ok' | 'degraded';
  db: ProbeStatus;
  redis: ProbeStatus;
  minio: ProbeStatus;
  uptime_s: number;
  version: string;
  checkedAt: string;
  details: {
    db: ProbeResult;
    redis: ProbeResult;
    minio: ProbeResult;
  };
}

/**
 * Readiness probe service for `/api/health` (Track E.2 Pass 2).
 *
 * Each probe is fail-soft individually (3s timeout) so a slow dependency
 * doesn't block the whole response. The aggregate `status` collapses to
 * `degraded` (→ HTTP 503) if any probe is `down`.
 *
 * Reuses the probe technique already in `setup.service.ts` (Prisma raw SELECT 1
 * for PostgreSQL, TCP socket for Redis, HTTP GET /minio/health/live for MinIO),
 * extracted here as a stable operator-facing contract decoupled from setup
 * wizard semantics.
 */
@Injectable()
export class HealthService {
  private readonly startTime = Date.now();
  private readonly probeTimeoutMs = 3000;

  constructor(private readonly prisma: PrismaClient) {}

  async checkAll(): Promise<HealthSnapshot> {
    const [db, redis, minio] = await Promise.all([
      this.probeDb(),
      this.probeRedis(),
      this.probeMinio(),
    ]);

    const allUp = db.status === 'up' && redis.status === 'up' && minio.status === 'up';

    return {
      status: allUp ? 'ok' : 'degraded',
      db: db.status,
      redis: redis.status,
      minio: minio.status,
      uptime_s: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.GLITCHTIP_RELEASE || process.env.npm_package_version || 'unknown',
      checkedAt: new Date().toISOString(),
      details: { db, redis, minio },
    };
  }

  private async probeDb(): Promise<ProbeResult> {
    const t0 = Date.now();
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), this.probeTimeoutMs)),
      ]);
      return { status: 'up', latencyMs: Date.now() - t0 };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      return { status: 'down', latencyMs: Date.now() - t0, error: msg };
    }
  }

  private probeRedis(): Promise<ProbeResult> {
    const host = process.env.REDIS_HOST || 'redis';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const t0 = Date.now();
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const settle = (status: ProbeStatus, error?: string) => {
        socket.destroy();
        resolve({ status, latencyMs: Date.now() - t0, error });
      };
      socket.setTimeout(this.probeTimeoutMs);
      socket.once('connect', () => settle('up'));
      socket.once('timeout', () => settle('down', `timeout ${host}:${port}`));
      socket.once('error', (err: NodeJS.ErrnoException) => settle('down', err.code || err.message));
      socket.connect(port, host);
    });
  }

  private async probeMinio(): Promise<ProbeResult> {
    const host = process.env.MINIO_ENDPOINT || 'minio';
    const port = parseInt(process.env.MINIO_PORT || '9000', 10);
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.probeTimeoutMs);
    try {
      const res = await fetch(`http://${host}:${port}/minio/health/live`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        return { status: 'down', latencyMs: Date.now() - t0, error: `HTTP ${res.status}` };
      }
      return { status: 'up', latencyMs: Date.now() - t0 };
    } catch (err: unknown) {
      clearTimeout(timer);
      const msg = err instanceof Error ? (err.name === 'AbortError' ? 'timeout' : err.message) : 'fetch failed';
      return { status: 'down', latencyMs: Date.now() - t0, error: msg };
    }
  }
}
