# ADR-001 : Stack JavaScript Full-TypeScript

Date : 2025-12-31
Statut : Accepté

## Contexte

XCH est une application web full-stack nécessitant :
- Type-safety pour réduire bugs runtime
- Développement rapide avec excellent DX
- Support PWA mobile natif
- Écosystème riche (PDF, QR codes, cartes, etc.)
- Maintenabilité long terme

## Décision

Adoption stack JavaScript/TypeScript complète :
- **Backend** : NestJS (Node.js + TypeScript)
- **Frontend** : Next.js 14 (React + TypeScript)
- **Type-safety** : 100% TypeScript strict mode

## Conséquences

### Positives

- **Type-safety bout en bout** : Erreurs détectées à la compilation, pas en production
- **Productivité** : Écosystème NPM mature, librairies nombreuses pour tous besoins
- **Maintenabilité** : Code auto-documenté via types, refactoring sûr avec IDE
- **Talent disponible** : Stack moderne, développeurs JavaScript/TypeScript abondants
- **Performance suffisante** : Node.js async I/O adapté au scope MVP (charge modérée)
- **PWA natif** : Next.js excellent support PWA, pas de stack mobile séparée

### Négatives

- **Performance brute** : Inférieure à Go/Rust pour calculs intensifs (non critique ici)
- **Typage runtime** : TypeScript disparaît à l'exécution (mitigation : validations Zod/class-validator)
- **Memory footprint** : Node.js plus gourmand que alternatives compilées

## Alternatives considérées

### Python (Django/FastAPI)
- **Rejetée** : Écosystème web moins mature pour PWA, frontend séparé complexifie
- Performance comparable Node.js
- Moins de librairies qualité pour génération PDF, manipulation images

### .NET (C# + ASP.NET Core)
- **Rejetée** : Excellente option technique mais lock-in Microsoft
- Moins de flexibilité déploiement on-premise Linux
- Écosystème frontend moins intégré

### Go
- **Rejetée** : Performance supérieure mais écosystème moins riche
- Génération PDF, manipulation images moins mature
- Frontend séparé (pas de SSR équivalent Next.js)

## Notes

Stack validée avec corrections :
- Multi-tenant via tenant_id + RLS (pas schema per tenant)
- Auth OIDC + locale
- RBAC/ABAC via Casbin
- CI/CD GitLab CI prioritaire
