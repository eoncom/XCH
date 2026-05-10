/**
 * Extract user-facing initials from a display name.
 * Handles annotated names like "[TEST 2026-05-09] Jean Dupont" by stripping
 * leading bracket/paren annotations before tokenizing — so the initial reflects
 * the actual person, not the annotation prefix.
 *
 * Examples:
 *   "Jean Dupont"                       → "JD"
 *   "[TEST 2026-05-09] Observateur 1"   → "O1"
 *   "(ext) Marie Curie"                 → "MC"
 *   "Alexandre"                         → "AL"
 *   "[TEST]"                            → fallback ("?")
 *   ""                                  → fallback ("?")
 */
export function getInitials(name?: string | null, fallback = '?'): string {
  if (!name) return fallback;
  const stripped = name.replace(/^\s*[[(][^\])]*[\])]\s*/g, '').trim();
  if (!stripped) return fallback;
  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
