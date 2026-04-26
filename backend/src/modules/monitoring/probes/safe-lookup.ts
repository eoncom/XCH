import { lookup as defaultLookup, LookupOneOptions } from 'dns';
import { isPrivateOrLoopback } from './target-validator';

/**
 * DNS-rebinding-proof lookup hook (ADR-014 §6 / §8).
 *
 * Returned function is signature-compatible with Node's `dns.lookup` and can
 * be passed to `http.Agent({ lookup })`, `axios` HTTP agents, and
 * `net.createConnection({ lookup })`. It intercepts the moment Node turns a
 * hostname into an IP, validates the IP against the same allowlist used at
 * CRUD time, and aborts the connection BEFORE the socket opens if the IP is
 * forbidden. Node still handles SNI / Host header naturally.
 *
 * Loopback (127/8, ::1) and link-local (169.254/16) are blocked regardless of
 * the `allowInternal` flag — see `target-validator.ts`.
 */
export function makeSafeLookup(allowInternal: boolean) {
  return function safeLookup(
    hostname: string,
    options: LookupOneOptions | number | ((err: NodeJS.ErrnoException | null, address: string, family: number) => void),
    callback?: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
  ): void {
    // Node's lookup is overloaded: lookup(host, cb) or lookup(host, opts, cb).
    // Normalize so we can inspect the address before forwarding the result.
    const cb = (typeof options === 'function' ? options : callback) as (
      err: NodeJS.ErrnoException | null,
      address: string,
      family: number,
    ) => void;
    const opts = (typeof options === 'function' ? {} : options) as LookupOneOptions | number;

    defaultLookup(hostname, opts as any, (err, address, family) => {
      if (err) return cb(err, '', 0);
      if (isPrivateOrLoopback(address, allowInternal)) {
        const blockErr: NodeJS.ErrnoException = new Error(
          `SSRF blocked: ${hostname} resolved to ${address} (private/loopback)`,
        );
        blockErr.code = 'EAI_AGAIN';
        return cb(blockErr, '', 0);
      }
      cb(null, address, family);
    });
  };
}
