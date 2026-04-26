import { TcpProbe } from './tcp.probe';
import { MonitorStatus } from '@prisma/client';

describe('TcpProbe — SSRF defense in depth', () => {
  const probe = new TcpProbe();

  it('blocks an IP-literal loopback target before opening a socket', async () => {
    const res = await probe.probe('127.0.0.1', 80, true);
    expect(res.status).toBe(MonitorStatus.DOWN);
    expect(res.error).toMatch(/SSRF blocked/);
    // No socket was opened — responseMs is null (we returned early).
    expect(res.responseMs).toBeNull();
  });

  it('blocks IPv6 loopback ::1 even with allowInternal=true', async () => {
    const res = await probe.probe('::1', 80, true);
    expect(res.status).toBe(MonitorStatus.DOWN);
    expect(res.error).toMatch(/SSRF blocked/);
  });

  it('blocks RFC1918 IP literals when allowInternal=false', async () => {
    const res = await probe.probe('10.0.0.1', 80, false);
    expect(res.status).toBe(MonitorStatus.DOWN);
    expect(res.error).toMatch(/SSRF blocked/);
  });

  it('returns DOWN with timeout error when the destination is unreachable', async () => {
    // 192.0.2.1 is RFC5737 TEST-NET-1 — guaranteed unrouted on the public
    // internet, so the probe will timeout. allowInternal=true so the host
    // passes the SSRF early check (TEST-NET-1 isn't in our blocklist).
    const res = await probe.probe('192.0.2.1', 81, true, 500);
    expect(res.status).toBe(MonitorStatus.DOWN);
    expect(res.error).toBeTruthy();
  }, 5000);
});
