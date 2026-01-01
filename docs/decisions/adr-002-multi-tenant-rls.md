# ADR-002 : Multi-tenant avec tenant_id + Row-Level Security

Date : 2025-12-31
Statut : Accepté

## Contexte

XCH doit supporter multi-délégation (multi-tenant) dans le futur, tout en restant mono-tenant pour le MVP. L'architecture doit être prête sans complexité excessive.

Deux approches principales :
1. **Schema per tenant** : Chaque tenant a son propre schema PostgreSQL
2. **Shared schema + tenant_id** : Une seule structure, isolation par clé tenant_id

## Décision

**Shared schema avec tenant_id + PostgreSQL Row-Level Security (RLS)**

### Architecture

Toutes les entités principales contiennent `tenantId` :

```prisma
model Site {
  id          String   @id @default(cuid())
  tenantId    String   // Clé d'isolation
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  code        String
  name        String
  // ...

  @@unique([tenantId, code])
  @@index([tenantId])
}
```

### PostgreSQL RLS

```sql
ALTER TABLE "Site" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Site"
  USING (tenant_id = current_setting('app.current_tenant_id')::text);
```

### NestJS Context

```typescript
async setTenantContext(tenantId: string) {
  await this.prisma.$executeRaw`SET app.current_tenant_id = ${tenantId}`;
}
```

## Conséquences

### Positives

- **Compatible Prisma** : Pas de multi-schema complexe, migrations simples
- **Backup/restore simple** : Une seule base de données
- **Performance** : Indexes sur tenant_id, queries rapides
- **Isolation garantie** : PostgreSQL RLS empêche fuites données
- **Déploiement simplifié** : Pas de gestion schemas dynamiques
- **Cost-effective** : Une seule instance PostgreSQL

### Négatives

- **Scaling limité** : Si un tenant très gros, impact potentiel autres tenants
- **Restauration sélective** : Plus complexe de restaurer un seul tenant
- **Noisy neighbor** : Requêtes lourdes d'un tenant peuvent ralentir autres

## Alternatives considérées

### Schema per tenant
- **Rejetée** : Complexité avec Prisma (multi-schema non natif)
- Migrations complexes (exécuter sur N schemas)
- Backup/restore fragmenté
- Provisioning tenant plus lent
- Avantage : Meilleure isolation, restauration sélective

### Database per tenant
- **Rejetée** : Over-engineering extrême pour MVP
- Coûts infrastructure explosifs
- Gestion opérationnelle cauchemardesque

## MVP

- Un seul tenant créé par défaut
- Architecture prête pour activation multi-tenant
- Middleware détection tenant désactivé
- RLS activé mais tenant_id fixe

## Migration future multi-tenant

Activation simple :
1. Activer middleware détection tenant (subdomain, header, JWT claim)
2. UI création tenants (admin global)
3. Provisioning automatique tenant (DB seed + config)
4. Facturation si SaaS

## Notes

Décision validée en remplacement de "schema per tenant" initial.
