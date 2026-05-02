import type { Page, Locator } from '@playwright/test';

/**
 * Helper Konva pour tests E2E (S7 PR2).
 *
 * Konva rend ses nodes dans un <canvas> HTML5, donc Playwright ne peut
 * pas sélectionner directement les éléments via DOM (rien à voir avec
 * SVG ou HTML). On combine deux stratégies :
 *
 * 1. Sélecteur canvas — récupérer le canvas Konva visible sur la page,
 *    via test-id `[data-testid="rack-viewer"]` ou fallback `canvas`.
 *
 * 2. Coordonnées calculées — pour cliquer / drag&drop sur une position
 *    Konva, on calcule les coordonnées absolues page (canvas bbox +
 *    offset relatif). Évite la fragilité des coords absolues figées.
 *
 * Pour les specs avancées PR4 (multi-mount, resize, rotation), envisager
 * d'instrumenter l'app pour exposer `window.__rackKonvaStage` et
 * permettre des assertions structurelles (Stage.findOne(...)).
 */

export interface KonvaCanvas {
  locator: Locator;
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Récupère le canvas Konva visible et son bounding box page.
 * Throw si aucun canvas trouvé après timeout.
 */
export async function getKonvaCanvas(page: Page, timeout = 5000): Promise<KonvaCanvas> {
  const canvas = page.locator('[data-testid="rack-viewer"], canvas').first();
  await canvas.waitFor({ state: 'visible', timeout });

  const bounds = await canvas.boundingBox();
  if (!bounds) {
    throw new Error('Canvas Konva visible mais boundingBox null — page non rendue ?');
  }
  return { locator: canvas, bounds };
}

/**
 * Clique à une position relative au canvas Konva.
 * `relX` et `relY` sont en fraction du canvas (0.0 à 1.0).
 * Ex: `clickKonvaAt(page, 0.5, 0.5)` clique au centre.
 */
export async function clickKonvaAt(page: Page, relX: number, relY: number): Promise<void> {
  const { bounds } = await getKonvaCanvas(page);
  const x = bounds.x + bounds.width * relX;
  const y = bounds.y + bounds.height * relY;
  await page.mouse.click(x, y);
}

/**
 * Drag&drop dans le canvas Konva, coordonnées relatives.
 * Utile pour mount un asset à une position U précise dans la baie.
 */
export async function dragKonvaFromTo(
  page: Page,
  fromRelX: number,
  fromRelY: number,
  toRelX: number,
  toRelY: number,
): Promise<void> {
  const { bounds } = await getKonvaCanvas(page);
  const fromX = bounds.x + bounds.width * fromRelX;
  const fromY = bounds.y + bounds.height * fromRelY;
  const toX = bounds.x + bounds.width * toRelX;
  const toY = bounds.y + bounds.height * toRelY;

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  // Mouvement intermédiaire pour que Konva détecte un drag (évite le
  // double-fire click si l'event s'est trop court).
  await page.mouse.move((fromX + toX) / 2, (fromY + toY) / 2, { steps: 10 });
  await page.mouse.move(toX, toY, { steps: 10 });
  await page.mouse.up();
}

/**
 * Calcule la position relative Y dans un rack Konva pour atteindre
 * la position U cible. La numérotation U commence en bas (1) et
 * monte vers le haut (heightU). Le canvas affiche le rack inversé
 * (top-down), donc on inverse aussi.
 *
 * Marge top/bottom de 5% pour les contours du rack rendus par Konva.
 */
export function uPositionToRelY(uPosition: number, heightU: number): number {
  if (uPosition < 1 || uPosition > heightU) {
    throw new Error(`uPosition ${uPosition} hors plage [1, ${heightU}]`);
  }
  const margin = 0.05;
  const usableHeight = 1 - 2 * margin;
  // U=1 (bas) → relY proche de 1-margin ; U=heightU (haut) → relY proche de margin
  const relativeFromTop = (heightU - uPosition + 0.5) / heightU;
  return margin + relativeFromTop * usableHeight;
}
