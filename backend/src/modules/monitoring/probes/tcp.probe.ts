import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';
import { MonitorStatus } from '@prisma/client';
import { ProbeResult } from './probe.types';
import { isPrivateOrLoopback, makeSafeLookup } from '../../../common/security/network';

const DEFAULT_TIMEOUT_MS = 5000;

@Injectable()
export class TcpProbe {
  private readonly logger = new Logger(TcpProbe.name);

  /**
   * Open a TCP connection to host:port, measure the time to ESTABLISHED, then
   * close cleanly. Returns UP on successful connect, DOWN on any error
   * (timeout, RST, refused). The `safeLookup` hook resolves hostnames and
   * blocks SSRF (DNS rebinding); IP literals bypass DNS so we re-check them
   * here as belt-and-suspenders.
   */
  async probe(
    host: string,
    port: number,
    allowInternal: boolean,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<ProbeResult> {
    // IP literals never reach the `lookup` hook — defense in depth.
    if (net.isIP(host) !== 0 && isPrivateOrLoopback(host, allowInternal)) {
      return {
        status: MonitorStatus.DOWN,
        responseMs: null,
        error: `SSRF blocked: ${host} is private/loopback`,
      };
    }

    return new Promise<ProbeResult>((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();
      let settled = false;

      const finish = (result: ProbeResult) => {
        if (settled) return;
        settled = true;
        socket.removeAllListeners();
        try { socket.destroy(); } catch { /* ignore */ }
        resolve(result);
      };

      socket.setTimeout(timeoutMs);

      socket.once('connect', () => {
        finish({
          status: MonitorStatus.UP,
          responseMs: Date.now() - start,
          error: null,
        });
      });

      socket.once('timeout', () => {
        finish({
          status: MonitorStatus.DOWN,
          responseMs: Date.now() - start,
          error: `timeout after ${timeoutMs}ms`,
        });
      });

      socket.once('error', (err: NodeJS.ErrnoException) => {
        finish({
          status: MonitorStatus.DOWN,
          responseMs: Date.now() - start,
          error: `${err.code || 'ERR'}: ${err.message}`,
        });
      });

      try {
        socket.connect({
          host,
          port,
          lookup: makeSafeLookup(allowInternal) as any,
        });
      } catch (err: any) {
        finish({
          status: MonitorStatus.DOWN,
          responseMs: null,
          error: `connect threw: ${err.message}`,
        });
      }
    });
  }
}
