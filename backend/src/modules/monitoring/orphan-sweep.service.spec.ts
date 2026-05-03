import { OrphanSweepService } from './orphan-sweep.service';
import { WorkerEventLogger } from '../../common/observability/worker-event-logger.service';
import { JOB_PROBE } from './monitor.scheduler';

/**
 * Unit test for boot-time orphan job sweep.
 *
 * Validates : (a) drops jobs whose checkId no longer exists in DB, (b)
 * leaves heartbeat jobs alone (no checkId), (c) leaves jobs with valid
 * checkId in place, (d) emits structured `boot-sweep` event with the
 * removed count.
 */
describe('OrphanSweepService.sweep()', () => {
  const mkJob = (id: string, name: string, data: any) => ({
    id,
    name,
    data,
    remove: jest.fn().mockResolvedValue(undefined),
  });

  const mkPrisma = (existingCheckIds: string[]): any => ({
    monitorCheck: {
      findMany: jest.fn().mockImplementation(({ where }: any) => {
        const ids: string[] = where.id.in;
        return Promise.resolve(
          ids.filter((id) => existingCheckIds.includes(id)).map((id) => ({ id })),
        );
      }),
    },
  });

  const mkQueue = (jobs: any[]): any => ({
    getJobs: jest.fn().mockResolvedValue(jobs),
  });

  const mkEvents = (): jest.Mocked<WorkerEventLogger> =>
    ({
      emit: jest.fn(),
      jobCompleted: jest.fn(),
      jobFailed: jest.fn(),
    }) as any;

  it('drops orphan probe jobs and keeps live ones', async () => {
    const j1 = mkJob('1', JOB_PROBE, { checkId: 'live-1' });
    const j2 = mkJob('2', JOB_PROBE, { checkId: 'orphan-1' });
    const j3 = mkJob('3', JOB_PROBE, { checkId: 'live-2' });
    const j4 = mkJob('4', JOB_PROBE, { checkId: 'orphan-2' });

    const prisma = mkPrisma(['live-1', 'live-2']);
    const queue = mkQueue([j1, j2, j3, j4]);
    const events = mkEvents();
    const svc = new OrphanSweepService(prisma, queue, events);

    const removed = await svc.sweep();

    expect(removed).toBe(2);
    expect(j2.remove).toHaveBeenCalledTimes(1);
    expect(j4.remove).toHaveBeenCalledTimes(1);
    expect(j1.remove).not.toHaveBeenCalled();
    expect(j3.remove).not.toHaveBeenCalled();

    // Final boot-sweep event with count
    expect(events.emit).toHaveBeenCalledWith(
      'info',
      expect.objectContaining({ event: 'boot-sweep', count: 2 }),
    );
    // 2 orphan-dropped events (warn level), one per orphan
    const orphanCalls = events.emit.mock.calls.filter(
      (c) => (c[1] as any).event === 'orphan-dropped',
    );
    expect(orphanCalls).toHaveLength(2);
    expect(orphanCalls[0][0]).toBe('warn');
  });

  it('ignores heartbeat jobs (no checkId payload)', async () => {
    const heartbeat = mkJob('h1', 'heartbeat', { ts: 12345 });
    const probe = mkJob('p1', JOB_PROBE, { checkId: 'live' });

    const prisma = mkPrisma(['live']);
    const queue = mkQueue([heartbeat, probe]);
    const events = mkEvents();
    const svc = new OrphanSweepService(prisma, queue, events);

    const removed = await svc.sweep();

    expect(removed).toBe(0);
    expect(heartbeat.remove).not.toHaveBeenCalled();
    expect(probe.remove).not.toHaveBeenCalled();
    expect(prisma.monitorCheck.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['live'] } },
      select: { id: true },
    });
  });

  it('emits boot-sweep with count=0 when no probe jobs queued', async () => {
    const prisma = mkPrisma([]);
    const queue = mkQueue([]);
    const events = mkEvents();
    const svc = new OrphanSweepService(prisma, queue, events);

    const removed = await svc.sweep();

    expect(removed).toBe(0);
    expect(events.emit).toHaveBeenCalledWith(
      'info',
      expect.objectContaining({ event: 'boot-sweep', count: 0 }),
    );
    expect(prisma.monitorCheck.findMany).not.toHaveBeenCalled();
  });

  it('continues sweeping if one job.remove() throws', async () => {
    const j1 = mkJob('1', JOB_PROBE, { checkId: 'orphan-1' });
    j1.remove.mockRejectedValueOnce(new Error('redis flake'));
    const j2 = mkJob('2', JOB_PROBE, { checkId: 'orphan-2' });

    const prisma = mkPrisma([]);
    const queue = mkQueue([j1, j2]);
    const events = mkEvents();
    const svc = new OrphanSweepService(prisma, queue, events);

    const removed = await svc.sweep();

    // j1 failed, j2 succeeded → count=1
    expect(removed).toBe(1);
    expect(j1.remove).toHaveBeenCalledTimes(1);
    expect(j2.remove).toHaveBeenCalledTimes(1);
  });

  it('dedupes checkIds when multiple jobs share one checkId', async () => {
    const j1 = mkJob('1', JOB_PROBE, { checkId: 'same' });
    const j2 = mkJob('2', JOB_PROBE, { checkId: 'same' });
    const j3 = mkJob('3', JOB_PROBE, { checkId: 'same' });

    const prisma = mkPrisma(['same']); // it exists → all 3 jobs are kept
    const queue = mkQueue([j1, j2, j3]);
    const events = mkEvents();
    const svc = new OrphanSweepService(prisma, queue, events);

    await svc.sweep();

    // findMany called with deduped IN clause
    expect(prisma.monitorCheck.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['same'] } },
      select: { id: true },
    });
  });
});
