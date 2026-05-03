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
});
