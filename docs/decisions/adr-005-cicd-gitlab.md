# ADR-005 : CI/CD avec GitLab CI (+ GitHub Actions optionnel)

Date : 2025-12-31
Statut : Accepté

## Contexte

XCH sera déployé dans des environnements entreprise avec contraintes spécifiques :
- GitLab self-hosted (parfois air-gapped, isolé internet)
- Runners on-premise
- Registry Docker interne
- Pipelines CI/CD automatisés (tests, build, déploiement)

Besoins :
- Support GitLab CI (prioritaire)
- Support GitHub Actions (optionnel, pour projets GitHub)
- Compatibilité air-gap (mirrors NPM, Docker)
- Sécurité (secrets, scan vulnérabilités)

## Décision

**Pipeline CI/CD dual : GitLab CI (prioritaire) + GitHub Actions (optionnel)**

### GitLab CI

Pipeline `.gitlab-ci.yml` avec stages :
1. **test** : Linting, tests unitaires, tests E2E, coverage
2. **build** : Build images Docker (app, frontend)
3. **deploy** : Déploiement staging/production

**Fichier `.gitlab-ci.yml`** :

```yaml
stages:
  - test
  - build
  - deploy

variables:
  DOCKER_REGISTRY: registry.internal.company.com
  APP_IMAGE: ${DOCKER_REGISTRY}/xch/app
  POSTGRES_HOST: postgres
  REDIS_HOST: redis

.node_template: &node_template
  image: node:20-alpine
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
      - .next/cache/

# Tests backend
test:backend:
  <<: *node_template
  stage: test
  script:
    - cd backend
    - npm ci
    - npm run lint
    - npm run test:cov
  coverage: '/Statements\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: backend/coverage/cobertura-coverage.xml
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == "main" || $CI_COMMIT_BRANCH == "develop"'

# Tests frontend
test:frontend:
  <<: *node_template
  stage: test
  script:
    - cd frontend
    - npm ci
    - npm run lint
    - npm run type-check
    - npm run test
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == "main" || $CI_COMMIT_BRANCH == "develop"'

# Tests E2E
test:e2e:
  image: mcr.microsoft.com/playwright:latest
  stage: test
  services:
    - name: postgres:15-alpine
      alias: postgres
    - name: redis:7-alpine
      alias: redis
  variables:
    POSTGRES_USER: xch_test
    POSTGRES_PASSWORD: test_password
    POSTGRES_DB: xch_test
  before_script:
    - npm ci
    - npm run db:migrate:test
  script:
    - npm run test:e2e
  artifacts:
    when: on_failure
    paths:
      - test-results/
      - playwright-report/
    expire_in: 7 days
  rules:
    - if: '$CI_COMMIT_BRANCH == "main" || $CI_COMMIT_BRANCH == "develop"'

# Scan sécurité (SAST)
sast:
  stage: test
  image: returntocorp/semgrep
  script:
    - semgrep --config=auto --json --output=sast-report.json
  artifacts:
    reports:
      sast: sast-report.json
  allow_failure: true
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

# Build image Docker
build:app:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $DOCKER_REGISTRY
  script:
    - docker build -t ${APP_IMAGE}:${CI_COMMIT_SHA} -t ${APP_IMAGE}:latest -f Dockerfile .
    - docker push ${APP_IMAGE}:${CI_COMMIT_SHA}
    - docker push ${APP_IMAGE}:latest
  rules:
    - if: '$CI_COMMIT_BRANCH == "main" || $CI_COMMIT_BRANCH == "develop"'

# Scan vulnérabilités image
scan:trivy:
  stage: build
  image: aquasec/trivy:latest
  script:
    - trivy image --severity HIGH,CRITICAL --exit-code 1 ${APP_IMAGE}:${CI_COMMIT_SHA}
  dependencies:
    - build:app
  allow_failure: true
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

# Déploiement staging
deploy:staging:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
  script:
    - ssh -o StrictHostKeyChecking=no $DEPLOY_USER@$STAGING_HOST "cd /opt/xch && docker-compose pull && docker-compose up -d --remove-orphans"
  environment:
    name: staging
    url: https://xch-staging.internal.company.com
  rules:
    - if: '$CI_COMMIT_BRANCH == "develop"'

# Déploiement production
deploy:production:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
  script:
    - ssh -o StrictHostKeyChecking=no $DEPLOY_USER@$PROD_HOST "cd /opt/xch && docker-compose pull && docker-compose up -d --remove-orphans"
  environment:
    name: production
    url: https://xch.internal.company.com
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
      when: manual  # Déploiement production manuel
```

**Variables CI/CD (GitLab Settings)** :
- `DOCKER_REGISTRY` : URL registry interne
- `CI_REGISTRY_USER` / `CI_REGISTRY_PASSWORD` : Auth registry
- `SSH_PRIVATE_KEY` : Clé SSH déploiement
- `DEPLOY_USER` : User SSH serveurs
- `STAGING_HOST` / `PROD_HOST` : IPs/hostnames serveurs

### GitHub Actions (optionnel)

Fichier `.github/workflows/ci.yml` :

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: xch_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: xch_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Run tests
        run: npm run test:cov
        env:
          DATABASE_URL: postgresql://xch_test:test_password@localhost:5432/xch_test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/cobertura-coverage.xml

  build:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'

    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t xch:${{ github.sha }} .

      - name: Login to registry
        run: echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin ${{ secrets.DOCKER_REGISTRY }}

      - name: Push image
        run: |
          docker tag xch:${{ github.sha }} ${{ secrets.DOCKER_REGISTRY }}/xch:${{ github.sha }}
          docker tag xch:${{ github.sha }} ${{ secrets.DOCKER_REGISTRY }}/xch:latest
          docker push ${{ secrets.DOCKER_REGISTRY }}/xch:${{ github.sha }}
          docker push ${{ secrets.DOCKER_REGISTRY }}/xch:latest
```

## Conséquences

### Positives

- **Flexibilité** : Support GitLab (entreprise) ET GitHub (open-source communauté)
- **Air-gap ready** : GitLab self-hosted fonctionne sans internet
- **Sécurité** : Secrets chiffrés, scan vulnérabilités (Trivy, Semgrep)
- **Traçabilité** : Chaque commit testé, images taguées par SHA
- **Automatisation** : Merge → tests → build → deploy staging automatique
- **Protection production** : Déploiement prod manuel (approval)

### Négatives

- **Maintenance** : Deux pipelines à maintenir (GitLab + GitHub)
- **Runners** : Nécessite runners GitLab configurés (CPU, Docker)
- **Complexité** : Setup initial registry, SSH keys, variables

## Alternatives considérées

### Jenkins
- **Rejetée** : Interface vieillissante, configuration complexe
- GitLab CI/GitHub Actions plus modernes, YAML déclaratif

### CircleCI / Travis CI
- **Rejetée** : SaaS uniquement, pas de self-hosted air-gap

### GitLab CI uniquement
- **Possible** : Simplifie maintenance
- GitHub Actions ajouté pour communauté open-source si besoin

## Air-gap support

**Mirrors requis** :

1. **NPM registry** : Verdaccio, Nexus ou Artifactory
   ```bash
   npm config set registry https://npm.internal.company.com
   ```

2. **Docker images** : Mirror Docker Hub
   ```yaml
   services:
     - name: registry.internal.company.com/postgres:15-alpine
       alias: postgres
   ```

3. **Git submodules** : Mirrors internes repos externes

**Workflow air-gap** :
1. Développement : Runners GitLab internes
2. Dependencies : Cache NPM/Docker interne
3. Déploiement : SSH vers serveurs internes (pas de cloud)

## Sécurité

**Secrets management** :
- GitLab CI Variables (masked, protected)
- GitHub Secrets (encrypted)
- Jamais de secrets hardcodés code/Dockerfile

**Scan vulnérabilités** :
- **SAST** : Semgrep (code source)
- **Container scanning** : Trivy (images Docker)
- **Dependency scanning** : npm audit, Snyk

**Image signing (optionnel)** :
- Cosign (sigstore) pour signature images
- Vérification signature avant déploiement prod

## Déploiement

**Stratégie** :
- **Staging** : Auto-deploy sur push `develop`
- **Production** : Manual approval sur push `main`

**Rollback** :
```bash
# SSH sur serveur prod
cd /opt/xch
docker-compose down
docker-compose pull xch:PREVIOUS_SHA
docker-compose up -d
```

**Blue/Green (future)** :
- Deux stacks Docker Compose (blue, green)
- Switch Traefik/Nginx entre stacks
- Zero downtime deployments

## Monitoring pipeline

**GitLab** :
- Pipelines dashboard
- Merge requests → CI status
- Coverage trends

**Notifications** :
- Slack/Mattermost webhooks
- Email sur échec pipeline prod

## Notes

Décision validée. GitLab CI prioritaire pour environnements entreprise self-hosted.
GitHub Actions maintenu pour compatibilité projets open-source.
Architecture prête pour air-gap complet avec mirrors internes.
