# Validation E2E S8 GlitchTip — handoff utilisateur

**Pour qui** : super-admin XCH validant la chaîne observabilité après deploy v2.1.0 sur xch-deploy.
**Pré-requis** : DSN GlitchTip déjà posés dans `backend/.env` + `frontend/.env`, conteneurs rebuildés.

## Préparation côté serveur (ce que TU fais)

1. **Récupérer les 3 DSN** une fois la stack GlitchTip démarrée :
   ```bash
   ssh xch-deploy
   cd /opt/xch-dev/XCH
   bash glitchtip/scripts/gen-dsn.sh
   ```
   Output attendu (3 lignes prêtes à coller) :
   ```
   GLITCHTIP_DSN_BACKEND=http://<key>@glitchtip-web:8000/1
   GLITCHTIP_DSN_WORKER=http://<key>@glitchtip-web:8000/2
   NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND=https://<key>@glitch.eoncom.io/3
   ```

2. **Coller les vars dans les .env du serveur** :
   - `backend/.env` : `GLITCHTIP_DSN_BACKEND=...` + `GLITCHTIP_DSN_WORKER=...` + `ENABLE_TEST_ERROR_ENDPOINTS=true`
   - `frontend/.env` : `NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND=...` + `NEXT_PUBLIC_ENABLE_TEST_ERROR_ENDPOINTS=true`
   - Note : `NEXT_PUBLIC_*` est bundlé au BUILD → il FAUT rebuild le frontend, pas juste restart.

3. **Rebuild + restart les 3 conteneurs** :
   ```bash
   docker compose build backend backend-worker frontend
   docker compose up -d backend backend-worker frontend
   ```

4. **Auth** : login en super-admin (`@demo.fr` / `Demo1234`) sur `https://xch.eoncom.io` pour récupérer le cookie de session HTTP-only. Garder la session ouverte pour les 3 tests.

## Test 1 — Backend unhandled exception

**Déclencheur** : navigation directe browser (le cookie session HTTP-only sera porté automatiquement).

```
GET https://xch.eoncom.io/api/_test-error/backend
```

Ou en CLI avec ton cookie session :
```bash
curl -i -b "xch.session=<ton-cookie>" https://xch.eoncom.io/api/_test-error/backend
```

**Réponse HTTP attendue** : `500 Internal Server Error` (c'est bien le but — l'erreur DOIT être unhandled pour atteindre le branche `else` du `AllExceptionsFilter` qui appelle `Sentry.captureException`).

**Dans GlitchTip UI** :
- Projet : **`xch-backend`**
- Title du event : `XCH_TEST_ERROR_BACKEND: synthetic unhandled exception (triggered by user=<ton-uuid>)`
- Tags attendus :
  - `mode = api`
  - `method = GET`
  - `route = /_test-error/backend` (pattern Express, pas l'URL avec params)
  - `environment = production` (ou ce que tu as set dans GLITCHTIP_ENVIRONMENT)
- Extras : `status_code = 500`, `path = /api/_test-error/backend`
- User context : `id = <ton-uuid>` SEULEMENT — **pas d'email** (vérification clé du scrubber).
- Stack trace : Node.js, doit pointer dans `test-error.controller.ts:triggerBackend`.

## Test 2 — Worker job throw

**Déclencheur** :
```bash
curl -i -X POST -b "xch.session=<ton-cookie>" https://xch.eoncom.io/api/_test-error/worker
```

**Réponse HTTP attendue** : `202 Accepted` + body `{"status":"enqueued","jobId":"<n>"}`.

Le job se déclenche async côté worker (~1s après l'enqueue). Surveille les logs du conteneur worker pour voir le throw :
```bash
docker logs xch-backend-worker --tail 20 -f
# attendu : ligne JSON `BullEvent {... "event":"job-failed", "queue":"test-error", "error":"XCH_TEST_ERROR_WORKER: ..."}`
```

**Dans GlitchTip UI** :
- Projet : **`xch-backend`** (même projet que le test 1, distingué par tag mode)
- Title : `XCH_TEST_ERROR_WORKER: synthetic worker failure (triggered by user=<ton-uuid>)`
- Tags attendus :
  - `mode = worker` ← **différence clé vs test 1** (initialScope set au boot via probe argv)
  - `queue = test-error`
  - `jobName = throw`
  - `errorCode = XCH_TEST_ERROR_WORKER` (extrait du SCREAMING_SNAKE prefix)
- Extras : `jobId = <n>`, `attempts = 1`
- Pas de user context (le worker n'a pas de session) — uniquement les tags ci-dessus.
- Stack trace : pointe `test-error.processor.ts:throw`.

## Test 3 — Frontend browser unhandled

**Déclencheur** : navigation browser
```
https://xch.eoncom.io/dashboard/test-error
```

Tu verras une page avec un bouton rouge "Déclencher erreur synthèse". **Avant de cliquer**, ouvre l'onglet Network du DevTools (filtre `glitch.eoncom.io`) pour voir le POST de l'event SDK partir.

**Clique le bouton.** Le component throw, l'error boundary `dashboard/error.tsx` capture, render la page d'erreur ("Cette page n'a pas pu se charger") + appelle `Sentry.captureException`.

**Vérifications** :
1. Network tab : 1 POST vers `https://glitch.eoncom.io/api/<id>/store/?...sentry_key=...` → réponse 200 (preuve que la CSP `connect-src` autorise et que NPM route).
2. Pas d'erreur CSP dans la console (sinon item 5 a un trou).

**Dans GlitchTip UI** :
- Projet : **`xch-frontend`**
- Title : `XCH_TEST_ERROR_FRONTEND: synthetic browser unhandled (ts=<...>)`
- Tags attendus :
  - `runtime = browser` ← distingue browser/ssr/edge
- User context : `id = <ton-uuid>` ; **pas d'email**.
- Stack trace : minifiée par défaut (source maps non uploadées — backlog item 8 si voulu).

## Critères d'acceptance v2.1.0 (à cocher)

- [ ] 3 events visibles dans GlitchTip UI (1 par projet pour le frontend, 2 dans xch-backend pour api+worker)
- [ ] Stack traces lisibles (au moins en non-minifié pour backend/worker ; minifié acceptable pour frontend en l'absence des source maps)
- [ ] Tags `mode` (api vs worker) présents et corrects sur xch-backend
- [ ] Tags `runtime` (browser) présent sur xch-frontend
- [ ] **Aucun event ne contient d'email** (preuve scrubber)
- [ ] CSP browser n'a PAS bloqué le POST (Network tab montre 200, pas un blocage)
- [ ] `bash scripts/audit-egress.sh` passe — voir item 7 du handoff (à venir)

## Cleanup post-validation (recommandé)

Une fois les 3 events validés, **désactiver les endpoints** pour ne pas laisser une surface de génération d'event en prod :

```
# backend/.env
ENABLE_TEST_ERROR_ENDPOINTS=false

# frontend/.env
NEXT_PUBLIC_ENABLE_TEST_ERROR_ENDPOINTS=false
```

Puis rebuild + restart frontend (le var est bundlée au build).

Vérifier que les 3 endpoints retournent maintenant 404 :
- `GET  /api/_test-error/backend` → 404
- `POST /api/_test-error/worker`  → 404
- `/dashboard/test-error`         → message "Test-error endpoint désactivé"
