import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as ping from 'ping';
import { MonitorStatus } from '@prisma/client';
import { ProbeResult } from './probe.types';
import { isPrivateOrLoopback } from '../../../common/security/network';
import { TcpProbe } from './tcp.probe';

const DEFAULT_TIMEOUT_SEC = 5;
const FALLBACK_TCP_PORT = 80;

/**
 * ICMP probe — tries real ICMP via the `ping` package (requires CAP_NET_RAW
 * on Linux for unprivileged users). If the capability is missing we fall
 * back to a TCP connect on port 80, which still tells us "is this host
 * reachable" without needing privileged sockets.
 *
 * The capability check runs once at module init so we log the fallback
 * exactly once at startup, not on every probe.
 */
@Injectable()
export class IcmpProbe implements OnModuleInit {
  private readonly logger = new Logger(IcmpProbe.name);
  private icmpAvailable = true;

  constructor(private readonly tcpProbe: TcpProbe) {}

  async onModuleInit() {
    // Probe loopback once with a tight deadline. If it fails with EPERM /
    // operation-not-permitted we know CAP_NET_RAW is missing.
    try {
      const res = await ping.promise.probe('127.0.0.1', { timeout: 1, extra: ['-c', '1'] });
      // Some implementations return alive=false even without raw socket
      // permissions — inspect the output to detect the EPERM signature.
      const out = (res?.output || '').toLowerCase();
      if (out.includes('operation not permitted') || out.includes('socket: permission denied')) {
        this.icmpAvailable = false;
        this.logger.warn(
          `ICMP raw socket unavailable (CAP_NET_RAW missing) — falling back to TCP:${FALLBACK_TCP_PORT} for ICMP probes. Add cap_add: [NET_RAW] to the worker container to enable real ICMP.`,
        );
      }
    } catch (err: any) {
      this.icmpAvailable = false;
      this.logger.warn(
        `ICMP self-test failed (${err?.message || err}) — falling back to TCP:${FALLBACK_TCP_PORT} for ICMP probes.`,
      );
    }
  }

  async probe(host: string, allowInternal: boolean, timeoutSec = DEFAULT_TIMEOUT_SEC): Promise<ProbeResult> {
    // The `ping` package doesn't accept a custom resolver, so we re-validate
    // the IP against the allowlist here when we get a literal — for hostnames
    // ICMP never leaves the worker since the OS resolver runs and ping uses
    // the resolved IP. We trust the upstream CRUD validation in that case.
    if (isHostIp(host) && isPrivateOrLoopback(host, allowInternal)) {
      return {
        status: MonitorStatus.DOWN,
        responseMs: null,
        error: `SSRF blocked: ${host} is private/loopback`,
      };
    }

    if (!this.icmpAvailable) {
      return this.tcpProbe.probe(host, FALLBACK_TCP_PORT, allowInternal, timeoutSec * 1000);
    }

    const start = Date.now();
    try {
      const res = await ping.promise.probe(host, { timeout: timeoutSec, extra: ['-c', '1'] });
      const responseMs = res?.time && res.time !== 'unknown' ? Number(res.time) : Date.now() - start;
      if (res.alive) {
        return { status: MonitorStatus.UP, responseMs: Number.isFinite(responseMs) ? responseMs : null, error: null };
      }
      return {
        status: MonitorStatus.DOWN,
        responseMs: Number.isFinite(responseMs) ? responseMs : null,
        error: 'host unreachable',
      };
    } catch (err: any) {
      return {
        status: MonitorStatus.DOWN,
        responseMs: Date.now() - start,
        error: `${err?.code || 'ERR'}: ${err?.message || String(err)}`,
      };
    }
  }
}

function isHostIp(host: string): boolean {
  // Tiny inline check — `net.isIP` returns 0 for non-IP, 4 or 6 for IP.
  // We use it rather than re-importing target-validator to avoid a cycle.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const net = require('net');
  return net.isIP(host) !== 0;
}
