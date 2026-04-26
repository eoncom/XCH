import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';
import { URL } from 'url';
import { MonitorStatus, MonitorHttpConfig, HttpMethod } from '@prisma/client';
import { ProbeResult } from './probe.types';
import { isPrivateOrLoopback, makeSafeAxios } from '../../../common/security/network';

const DEFAULT_TIMEOUT_MS = 5000;

@Injectable()
export class HttpProbe {
  private readonly logger = new Logger(HttpProbe.name);

  /**
   * Issue an HTTP(S) request and check status + optional body substring.
   * UP iff status matches `expectedStatus` (default 200) AND
   * `expectedBodyContains` is found (when set). Otherwise DOWN with the
   * mismatch reason.
   *
   * The custom http/https Agent uses `safeLookup` to abort the connection
   * if the resolved IP falls in a forbidden range — Node still handles
   * SNI / Host naturally because we only intercept name resolution.
   */
  async probe(
    url: string,
    config: MonitorHttpConfig | null,
    allowInternal: boolean,
  ): Promise<ProbeResult> {
    // IP literals in the URL bypass the lookup hook — defense in depth.
    try {
      const parsed = new URL(url);
      const cleanHost = parsed.hostname.startsWith('[') && parsed.hostname.endsWith(']')
        ? parsed.hostname.slice(1, -1)
        : parsed.hostname;
      if (net.isIP(cleanHost) !== 0 && isPrivateOrLoopback(cleanHost, allowInternal)) {
        return {
          status: MonitorStatus.DOWN,
          responseMs: null,
          error: `SSRF blocked: ${cleanHost} is private/loopback`,
        };
      }
    } catch {
      return { status: MonitorStatus.DOWN, responseMs: null, error: 'invalid URL' };
    }

    const method = (config?.method ?? HttpMethod.GET) as HttpMethod;
    const expectedStatus = config?.expectedStatus ?? 200;
    const expectedBody = config?.expectedBodyContains ?? null;
    const followRedirects = config?.followRedirects ?? true;
    const timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const { client, cleanup } = makeSafeAxios(allowInternal, {
      timeoutMs,
      followRedirects,
    });

    const start = Date.now();
    try {
      const res = await client.request({
        url,
        method: method.toLowerCase() as 'get' | 'head' | 'post',
      });
      const responseMs = Date.now() - start;

      if (res.status !== expectedStatus) {
        return {
          status: MonitorStatus.DOWN,
          responseMs,
          error: `unexpected status ${res.status} (expected ${expectedStatus})`,
        };
      }

      if (expectedBody) {
        const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
        if (!body.includes(expectedBody)) {
          return {
            status: MonitorStatus.DOWN,
            responseMs,
            error: `body does not contain expected substring`,
          };
        }
      }

      return { status: MonitorStatus.UP, responseMs, error: null };
    } catch (err: any) {
      const responseMs = Date.now() - start;
      const code = err?.code || 'ERR';
      const msg = err?.message || String(err);
      return {
        status: MonitorStatus.DOWN,
        responseMs,
        error: `${code}: ${msg}`,
      };
    } finally {
      cleanup();
    }
  }
}
