import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { makeSafeLookup } from './safe-lookup';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BYTES = 1024 * 1024; // 1 MB — plenty for health endpoints / webhooks

/**
 * SSRF-safe http.Agent + https.Agent factory (ADR-016).
 *
 * Both agents inject a `lookup` hook that re-validates the resolved IP
 * against the allowlist BEFORE the socket opens, defeating DNS rebinding.
 * IP literals bypass DNS — callers must validate URL/host upstream with
 * `url-validator` / `host-validator` for defense in depth.
 *
 * `keepAlive: false` because monitor probes / one-shot webhooks do not
 * benefit from connection reuse and we don't want long-lived sockets
 * holding state inside the worker.
 */
export function makeSafeAgents(allowInternal: boolean): {
  httpAgent: http.Agent;
  httpsAgent: https.Agent;
} {
  const lookup = makeSafeLookup(allowInternal) as any;
  return {
    httpAgent: new http.Agent({ lookup, keepAlive: false }),
    httpsAgent: new https.Agent({ lookup, keepAlive: false }),
  };
}

export interface SafeAxiosOptions {
  /** Request timeout (default 5s). */
  timeoutMs?: number;
  /** Max response size in bytes (default 1 MB). */
  maxBytes?: number;
  /** Follow HTTP redirects (default true). */
  followRedirects?: boolean;
  /** Treat any HTTP status as resolved — caller decides UP/DOWN (default true). */
  validateAnyStatus?: boolean;
}

/**
 * Pre-configured axios instance with SSRF-safe agents and sane production
 * defaults (timeout, body cap, redirects). Cleans up its sockets when the
 * caller is done — call `cleanup()` after the request to avoid leaks.
 */
export function makeSafeAxios(
  allowInternal: boolean,
  options: SafeAxiosOptions = {},
): {
  client: AxiosInstance;
  cleanup: () => void;
} {
  const { httpAgent, httpsAgent } = makeSafeAgents(allowInternal);
  const cfg: AxiosRequestConfig = {
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRedirects: options.followRedirects === false ? 0 : 5,
    maxContentLength: options.maxBytes ?? DEFAULT_MAX_BYTES,
    maxBodyLength: options.maxBytes ?? DEFAULT_MAX_BYTES,
    httpAgent,
    httpsAgent,
  };
  if (options.validateAnyStatus !== false) {
    cfg.validateStatus = () => true;
  }
  const client = axios.create(cfg);
  return {
    client,
    cleanup: () => {
      httpAgent.destroy();
      httpsAgent.destroy();
    },
  };
}
