import { HealthStatus } from '@prisma/client';
import { computeOverall, type HealthComponent } from './health-aggregation.service';

/**
 * Tests unitaires de `computeOverall()` (post-v1.9.0 fix bug agrégation
 * sévérité site SD-WAN).
 *
 * Régression couverte : un équipement SD-WAN monitoré qui tombe down
 * faisait passer le site en WARNING au lieu de CRITICAL. La condition
 * `hasWarning` mélangeait `impact='warning'` ET `impact='critical'`,
 * donc l'impact 'critical' n'était jamais distingué.
 *
 * Logique cible : équipement SD-WAN critique down → site CRITICAL
 * immédiat, indépendamment de l'état des liens (monitorés ou non).
 * Les liens non monitorés ne sont pas une preuve que tout va bien —
 * c'est un manque d'information.
 */

const link = (
  status: HealthComponent['status'],
  impact: HealthComponent['impact'],
): HealthComponent => ({
  type: 'link',
  id: `link-${Math.random()}`,
  name: 'Lien Test',
  status,
  impact,
});

const sdwan = (
  status: HealthComponent['status'],
  impact: HealthComponent['impact'],
): HealthComponent => ({
  type: 'sdwan',
  id: 'sdwan',
  name: 'SD-WAN Test',
  status,
  impact,
});

const asset = (
  status: HealthComponent['status'],
  impact: HealthComponent['impact'],
): HealthComponent => ({
  type: 'asset',
  id: `asset-${Math.random()}`,
  name: 'Asset Test',
  status,
  impact,
});

const siteMonitor = (
  status: HealthComponent['status'],
  impact: HealthComponent['impact'],
): HealthComponent => ({
  type: 'site-monitor',
  id: `site-check-${Math.random()}`,
  name: 'Surveillance site (test)',
  status,
  impact,
});

describe('computeOverall', () => {
  describe('cas dégénérés', () => {
    it('aucun composant → UNKNOWN', () => {
      expect(computeOverall([])).toBe(HealthStatus.UNKNOWN);
    });

    it('tous composants unknown → UNKNOWN', () => {
      expect(
        computeOverall([asset('unknown', 'none'), asset('unknown', 'none')]),
      ).toBe(HealthStatus.UNKNOWN);
    });
  });

  describe('CRITICAL : total connectivity loss', () => {
    it('1 lien single down (impact critical via linkImpact) → CRITICAL', () => {
      // linkImpact pose impact='critical' quand totalLinks <= 1 et status=down.
      // Reproduit ici à la main pour ne pas dépendre de la fonction.
      expect(computeOverall([link('down', 'critical')])).toBe(HealthStatus.CRITICAL);
    });

    it('2 liens, tous down → CRITICAL (total loss)', () => {
      // Plusieurs liens DOWN : chaque lien a impact='warning' (degraded
      // redundancy) mais le check links.every(down) escalade en CRITICAL.
      expect(
        computeOverall([link('down', 'warning'), link('down', 'warning')]),
      ).toBe(HealthStatus.CRITICAL);
    });

    it('1 lien up, 1 lien down → WARNING (pas de total loss)', () => {
      expect(
        computeOverall([link('up', 'none'), link('down', 'warning')]),
      ).toBe(HealthStatus.WARNING);
    });
  });

  describe('CRITICAL : SD-WAN équipement critique down (regression v1.9.0+1)', () => {
    it('SD-WAN tous firewalls down + zéro liens monitorés → CRITICAL', () => {
      // Cas du bug rapporté : équipement SD-WAN monitoré qui tombe.
      // Avant fix : retournait WARNING (sdwan impact='warning' lumpé avec
      // autres warnings). Après fix : sdwan impact='critical' → CRITICAL.
      expect(computeOverall([sdwan('down', 'critical')])).toBe(HealthStatus.CRITICAL);
    });

    it('SD-WAN tous firewalls down + 1 lien up → CRITICAL', () => {
      // Liens monitorés UP ne masquent PAS l'incident SD-WAN.
      expect(
        computeOverall([sdwan('down', 'critical'), link('up', 'none')]),
      ).toBe(HealthStatus.CRITICAL);
    });

    it('SD-WAN degraded (partial firewalls down) + lien up → WARNING', () => {
      // SD-WAN partiellement down = degraded redundancy, pas une perte
      // totale. Reste en WARNING.
      expect(
        computeOverall([sdwan('degraded', 'warning'), link('up', 'none')]),
      ).toBe(HealthStatus.WARNING);
    });
  });

  describe('CRITICAL : impact critical générique (extensibilité future)', () => {
    it('asset avec impact=critical → CRITICAL (extension future)', () => {
      // Si un assetImpact évolue pour marquer certains assets critiques
      // (ex: UPS, core switch), le pattern devrait fonctionner.
      expect(computeOverall([asset('down', 'critical')])).toBe(HealthStatus.CRITICAL);
    });
  });

  describe('WARNING : équipement non-critique down (comportement préservé)', () => {
    it('asset standard down impact=warning → WARNING', () => {
      expect(computeOverall([asset('down', 'warning')])).toBe(HealthStatus.WARNING);
    });

    it('asset down + 1 lien up → WARNING (équipement seul ne fait pas CRITICAL)', () => {
      expect(
        computeOverall([asset('down', 'warning'), link('up', 'none')]),
      ).toBe(HealthStatus.WARNING);
    });

    it('composant degraded → WARNING', () => {
      expect(computeOverall([sdwan('degraded', 'warning')])).toBe(HealthStatus.WARNING);
    });
  });

  describe('HEALTHY : tout up', () => {
    it('1 lien up → HEALTHY', () => {
      expect(computeOverall([link('up', 'none')])).toBe(HealthStatus.HEALTHY);
    });

    it('combinaison link+sdwan+asset tous up → HEALTHY', () => {
      expect(
        computeOverall([
          link('up', 'none'),
          sdwan('up', 'none'),
          asset('up', 'none'),
        ]),
      ).toBe(HealthStatus.HEALTHY);
    });

    it('majoritairement up + 1 unknown → HEALTHY', () => {
      // Un seul composant unknown ne dégrade pas si d'autres sont up.
      expect(
        computeOverall([link('up', 'none'), asset('unknown', 'none')]),
      ).toBe(HealthStatus.HEALTHY);
    });
  });

  describe('site-monitor type (post-v1.9.1 fix UI label)', () => {
    it('site-monitor up seul → HEALTHY', () => {
      expect(computeOverall([siteMonitor('up', 'none')])).toBe(HealthStatus.HEALTHY);
    });

    it('site-monitor down seul → WARNING (impact warning, pas critical)', () => {
      // Un site-monitor down (ping public DNS, HTTP tiers, TCP service)
      // ne fait JAMAIS escalader le site en CRITICAL — c'est un signal
      // contextuel, pas une perte de service du site lui-même. Reste en
      // WARNING comme un asset down standard.
      expect(computeOverall([siteMonitor('down', 'warning')])).toBe(HealthStatus.WARNING);
    });

    it('site-monitor up + lien up + asset up → HEALTHY', () => {
      expect(
        computeOverall([
          link('up', 'none'),
          siteMonitor('up', 'none'),
          asset('up', 'none'),
        ]),
      ).toBe(HealthStatus.HEALTHY);
    });

    it('site-monitor down + 0 lien monitoré → WARNING (pas CRITICAL)', () => {
      // Si aucun lien n'a de monitor (ou tous unknown), le site-monitor
      // down seul fait juste WARNING. Pas d'escalade CRITICAL car aucun
      // composant impact='critical' (les site-monitor ne sont jamais
      // marqués critical par assetImpact).
      expect(computeOverall([siteMonitor('down', 'warning')])).toBe(HealthStatus.WARNING);
    });
  });

  describe('priorité ordre de check (CRITICAL > WARNING)', () => {
    it('SD-WAN down + lien up + asset down → CRITICAL (SD-WAN gagne)', () => {
      // Mix de composants : un critical doit emporter sur warning.
      expect(
        computeOverall([
          sdwan('down', 'critical'),
          link('up', 'none'),
          asset('down', 'warning'),
        ]),
      ).toBe(HealthStatus.CRITICAL);
    });

    it('liens tous down + asset down warning → CRITICAL (total loss prioritaire)', () => {
      expect(
        computeOverall([
          link('down', 'warning'),
          link('down', 'warning'),
          asset('down', 'warning'),
        ]),
      ).toBe(HealthStatus.CRITICAL);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Sémantique severity (ADR-022)
  // ───────────────────────────────────────────────────────────────────────

  describe('sémantique severity ADR-022', () => {
    it('PRIMARY link DOWN (severity=CRITICAL via flag) + BACKUP UP → CRITICAL', () => {
      // Cas refonte : avant ADR-022, ce scénario tombait WARNING
      // (linkImpact totalLinks > 1 → 'warning'). Après : le flag severity
      // sur le check du PRIMARY le marque CRITICAL → site CRITICAL.
      expect(
        computeOverall([link('down', 'critical'), link('up', 'none')]),
      ).toBe(HealthStatus.CRITICAL);
    });

    it('BACKUP link DOWN seul (severity=WARNING) + PRIMARY UP → WARNING', () => {
      // Le BACKUP DOWN dégrade la redondance mais le service nominal couvre.
      expect(
        computeOverall([link('up', 'none'), link('down', 'warning')]),
      ).toBe(HealthStatus.WARNING);
    });

    it('asset CRITICAL down (admin override) → CRITICAL', () => {
      // Override admin : un core switch ou UPS marqué CRITICAL via UI.
      // Same shape qu'un PRIMARY link DOWN.
      expect(computeOverall([asset('down', 'critical')])).toBe(HealthStatus.CRITICAL);
    });

    it('check INFO down → HEALTHY si rien d\'autre escalade', () => {
      // INFO impact = soft signal, ne dégrade pas (forward-compat).
      // Ici site-monitor avec impact='info' down + 1 link UP → HEALTHY.
      expect(
        computeOverall([
          link('up', 'none'),
          siteMonitor('down', 'info'),
        ]),
      ).toBe(HealthStatus.HEALTHY);
    });

    it('check INFO down isolé (rien d\'autre monitoré) → UNKNOWN-like fallback', () => {
      // INFO ne crée pas d'escalade. Un check INFO down isolé est
      // équivalent à pas de signal positif (unknown-ish). Le fallback
      // UNKNOWN s'applique car aucun composant up.
      expect(computeOverall([siteMonitor('down', 'info')])).toBe(HealthStatus.UNKNOWN);
    });

    it('matrice complète : CRITICAL down + WARNING down + INFO down → CRITICAL', () => {
      expect(
        computeOverall([
          asset('down', 'critical'),
          asset('down', 'warning'),
          siteMonitor('down', 'info'),
        ]),
      ).toBe(HealthStatus.CRITICAL);
    });

    it('matrice : WARNING down + INFO down + UP component → WARNING (INFO ignoré)', () => {
      expect(
        computeOverall([
          asset('down', 'warning'),
          siteMonitor('down', 'info'),
          link('up', 'none'),
        ]),
      ).toBe(HealthStatus.WARNING);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Couverture partielle (cf XCH_HEALTH_AGGREGATION_SEMANTICS DEF-01)
  // ───────────────────────────────────────────────────────────────────────

  describe('couverture partielle — non-monitoré ne dégrade pas', () => {
    it('1 lien UP + 1 lien sans monitor (filtré au load, absent du composants) → HEALTHY', () => {
      // Au moment du computeOverall, un link sans monitor n'apparaît PAS
      // dans la liste components (filtré dans recomputeSite step 1).
      // Reste : 1 link UP → HEALTHY.
      expect(computeOverall([link('up', 'none')])).toBe(HealthStatus.HEALTHY);
    });

    it('site-level UP seul (0 lien, 0 asset monitoré) → HEALTHY', () => {
      // Pas d'exigence cachée de couverture minimale par type de composant.
      expect(computeOverall([siteMonitor('up', 'none')])).toBe(HealthStatus.HEALTHY);
    });

    it('rien monitoré du tout → UNKNOWN', () => {
      expect(computeOverall([])).toBe(HealthStatus.UNKNOWN);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// HealthAggregationService — tests d'intégration légers (race + queue)
// ─────────────────────────────────────────────────────────────────────────

import { HealthAggregationService } from './health-aggregation.service';

describe('HealthAggregationService.enqueueRecompute()', () => {
  const mkQueue = () => ({
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  });
  const mkPrisma = () => ({
    site: { findUnique: jest.fn(), update: jest.fn() },
    siteHealthSnapshot: { upsert: jest.fn() },
    $transaction: jest.fn(),
  });

  it('passes jobId=siteId + delay=300 + removeOnComplete=true to queue.add', async () => {
    const queue: any = mkQueue();
    const prisma: any = mkPrisma();
    const svc = new HealthAggregationService(prisma, queue);

    await svc.enqueueRecompute('site-abc', 'probe:check-xyz');

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [name, data, opts] = queue.add.mock.calls[0];
    expect(name).toBe('recompute');
    expect(data).toEqual({ siteId: 'site-abc', source: 'probe:check-xyz' });
    expect(opts).toMatchObject({
      jobId: 'site-abc',
      delay: 300,
      removeOnComplete: true,
    });
  });

  it('multiple enqueues for same site each call queue.add with same jobId (Bull dedupe at runtime)', async () => {
    const queue: any = mkQueue();
    const prisma: any = mkPrisma();
    const svc = new HealthAggregationService(prisma, queue);

    await svc.enqueueRecompute('site-X', 'probe:1');
    await svc.enqueueRecompute('site-X', 'probe:2');
    await svc.enqueueRecompute('site-X', 'probe:3');

    // Service-level : we always call queue.add — Bull is the one that
    // dedupes via jobId + delay window (verified by integration / smoke).
    expect(queue.add).toHaveBeenCalledTimes(3);
    expect(queue.add.mock.calls.every((c: any[]) => c[2].jobId === 'site-X')).toBe(true);
  });

  it('different sites get different jobIds (no cross-site dedup)', async () => {
    const queue: any = mkQueue();
    const prisma: any = mkPrisma();
    const svc = new HealthAggregationService(prisma, queue);

    await svc.enqueueRecompute('site-A', 'probe:1');
    await svc.enqueueRecompute('site-B', 'probe:2');

    const jobIds = queue.add.mock.calls.map((c: any[]) => c[2].jobId);
    expect(jobIds).toEqual(['site-A', 'site-B']);
  });

  it('swallows queue.add() failure (logs only — does not throw)', async () => {
    const queue: any = mkQueue();
    queue.add.mockRejectedValueOnce(new Error('redis flake'));
    const prisma: any = mkPrisma();
    const svc = new HealthAggregationService(prisma, queue);

    // Should not throw — caller (probe handler) shouldn't fail because of
    // an enqueue glitch. The 5-min cron rattrape.
    await expect(svc.enqueueRecompute('site-Z', 'probe:1')).resolves.toBeUndefined();
  });
});
