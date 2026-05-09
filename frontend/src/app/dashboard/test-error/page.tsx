'use client';

/**
 * `/dashboard/test-error` — page synthèse pour valider la chaîne
 * GlitchTip browser (item 6 / critère acceptance v2.1.0).
 *
 * Note convention App Router : on aurait préféré le path `_test-error`
 * pour signaler "internal/private", mais Next 15 traite le préfixe `_`
 * sur un dossier comme "private folder, not routable" → on utilise donc
 * `test-error` sans underscore. Le gating reste fort (super-admin +
 * env flag) donc l'URL non-cachée n'est pas un problème.
 *
 * Gating (DEUX checks indépendants) :
 *   1. `NEXT_PUBLIC_ENABLE_TEST_ERROR_ENDPOINTS=true` au build (sinon désactivé)
 *   2. `user.isSuperAdmin === true` côté store
 * Si l'un ou l'autre échoue → message clair, pas de bouton throw.
 *
 * Quand le bouton est cliqué : throw synchrone dans le render → l'erreur
 * remonte jusqu'à `dashboard/error.tsx` (Next 15 error boundary du segment),
 * qui appelle `Sentry.captureException` avec scrubber + tag runtime=browser.
 */

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';

const ENABLED = process.env.NEXT_PUBLIC_ENABLE_TEST_ERROR_ENDPOINTS === 'true';

function ThrowingComponent({ now }: { now: number }): null {
  // Throw synchrone DURANT le render — c'est ce que React traite via
  // l'error boundary parent (dashboard/error.tsx).
  throw new Error(`XCH_TEST_ERROR_FRONTEND: synthetic browser unhandled (ts=${now})`);
}

export default function TestErrorPage() {
  const { user } = useAuthStore();
  const [trigger, setTrigger] = useState<number | null>(null);

  if (!ENABLED) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold mb-2">Test-error endpoint désactivé</h1>
        <p className="text-sm text-muted-foreground">
          La variable <code>NEXT_PUBLIC_ENABLE_TEST_ERROR_ENDPOINTS</code> n&apos;est pas
          set à <code>true</code> au build. Page indisponible.
        </p>
      </div>
    );
  }

  if (!user?.isSuperAdmin) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold mb-2">Accès refusé</h1>
        <p className="text-sm text-muted-foreground">
          Réservé aux super administrateurs.
        </p>
      </div>
    );
  }

  // ThrowingComponent provoque le throw au render quand `trigger` est non-null.
  // L'error boundary `dashboard/error.tsx` capture et appelle Sentry.
  if (trigger !== null) {
    return <ThrowingComponent now={trigger} />;
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-xl font-semibold">Test GlitchTip — frontend</h1>
      <p className="text-sm text-muted-foreground">
        Cliquer le bouton lèvera une exception non-handled qui sera capturée par
        l&apos;error boundary <code>dashboard/error.tsx</code> et envoyée à
        GlitchTip (projet <code>xch-frontend</code>, tag{' '}
        <code>runtime=browser</code>).
      </p>
      <button
        type="button"
        onClick={() => setTrigger(Date.now())}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
      >
        Déclencher erreur synthèse
      </button>
      <p className="text-xs text-muted-foreground">
        Après clic : vous verrez l&apos;ErrorState page de l&apos;error boundary, et
        l&apos;event apparaîtra dans GlitchTip UI sous quelques secondes.
      </p>
    </div>
  );
}
