'use client';

/**
 * S7 PR0 — TEST NÉGATIF baseline check (DO NOT MERGE).
 *
 * Ce fichier viole délibérément le pattern S6 PR4 (useQuery destructuré
 * avec isLoading SANS isError). Son ajout doit faire passer le compteur
 * `useQuery_isError_files` de 32 à 33 et `useQuery_isError_warnings` de
 * 38 à 39, déclenchant le baseline check `❌ RÉGRESSION` et CI fail.
 *
 * Sera retiré dans le commit suivant pour valider le retour vert.
 *
 * Cf entité MCP XCH_CI_SCRIPT_DEFENSIVE_PATTERNS — Règle 4 (test du
 * check lui-même, "CI vert" ≠ "CI fonctionne").
 */

import { useQuery } from '@tanstack/react-query';

export default function BaselineTestPage() {
  // VIOLATION INTENTIONNELLE : pas de isError destructuré
  const { data, isLoading } = useQuery({
    queryKey: ['baseline-test'],
    queryFn: async () => ({ test: true }),
  });

  if (isLoading) return <div>Loading...</div>;
  return <div>baseline test: {JSON.stringify(data)}</div>;
}
