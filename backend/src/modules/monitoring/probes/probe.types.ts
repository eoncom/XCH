import { MonitorStatus } from '@prisma/client';

/**
 * Common result shape returned by every probe. The processor writes this
 * verbatim into a MonitorResult row.
 */
export interface ProbeResult {
  status: MonitorStatus;
  responseMs: number | null;
  error: string | null;
}
