// S7 PR0 — Flat config ESLint pour Next.js 15 + règle custom useQuery isError.
//
// La règle no-restricted-syntax est en niveau "warn" (mode MESURE) :
// elle apparaît dans le diagnostic du workflow frontend-checks.yml mais
// ne fait pas échouer le check. Cf XCH_ENGINEERING_PRINCIPLES — "mesurer
// avant d'enforcer".
//
// Décision DURANT la PR0 (utilisateur arbitrera quand chiffres connus) :
//   (a) corriger toutes les violations dans la même PR0
//   (b) baseline acceptée legacy + enforce strict tout nouveau code via
//       règle eslint qui catch les nouveaux ajouts (pas les existants)
//
// La règle vise à enforcer le pattern issu de S6 PR4 : tout `useQuery`
// destructuré avec `isLoading` doit aussi destructurer `isError` (ou
// `error`) pour que la page puisse afficher un état d'erreur réseau via
// <ErrorState>. Sinon les pages échouent silencieusement quand le
// backend tombe.

import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default [
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          // ObjectPattern qui destructure `isLoading` mais pas `isError`
          // ni `error` — typique d'un useQuery sans handling d'erreur.
          selector:
            "ObjectPattern:has(Property[key.name='isLoading']):not(:has(Property[key.name='isError'])):not(:has(Property[key.name='error']))",
          message:
            'S6 PR4 pattern : useQuery destructuré avec isLoading doit aussi destructurer isError (ou error) pour permettre <ErrorState> en cas de panne réseau.',
        },
      ],
    },
  },
];
