#!/usr/bin/env ts-node
/**
 * check-bola.ts — Track E.4 PR1 Pass 2 BOLA lint check.
 *
 * Détecte les patterns suspects `findUnique({ where: { id }` ou
 * `findOne({ where: { id }` SANS `tenantId` adjacent dans le where, qui
 * sont des candidats BOLA (Broken Object Level Authorization, OWASP API1).
 *
 * Pattern figé MCP `XCH_BOLA_PATTERN_CHECK` — un caller tenantA avec
 * MANAGE peut lire/manipuler un objet tenantB s'il connaît l'ID, si le
 * service ne scope pas la query par `tenantId`.
 *
 * Cas légitimes (whitelistés en `BOLA_LEGITIMATE_EXCEPTIONS`) :
 *   - Setup wizard (tenantId pas encore connu)
 *   - Auth (lookup user par ID pour token validation, pas tenant-scope)
 *   - Cron / system_ctx (SYSTEM_CTX(...) injecté)
 *
 * Pattern ts-node-only (pas de ts-morph) — modèle inspiré
 * `backend/scripts/check-dto-coverage.ts`. Exit 0 si 0 violation,
 * 1 si violations détectées (mode strict bloquant CI Track F).
 *
 * Pour MVP Track E.4 Pass 2 : mode warning baseline (exit 0 toujours, juste
 * log les findings) — règle "mesurer avant d'enforcer" (XCH_ENGINEERING_PRINCIPLES).
 * Promotion bloquant Track F si baseline = 0.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', 'src');
const BOLA_LEGITIMATE_EXCEPTIONS = new Set<string>([
  // Setup/auth flows : tenantId pas encore connu au lookup initial
  'src/modules/setup/setup.service.ts',
  'src/modules/auth/auth.service.ts',
  // Health probe : SELECT 1 sans scope
  'src/modules/health/health.service.ts',
  // PermissionService : helpers internes, scope dérivé du caller
  'src/common/services/permission.service.ts',
  // AuditLogService : scope toujours par tenantId via callsites, helper interne
  'src/common/services/audit-log.service.ts',
]);

interface Finding {
  file: string;
  line: number;
  snippet: string;
  pattern: 'findUnique' | 'findOne' | 'findFirst';
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, files);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(full);
    }
  }
  return files;
}

function relPath(p: string): string {
  return path.relative(path.resolve(__dirname, '..'), p).replace(/\\/g, '/');
}

function scan(file: string): Finding[] {
  const rel = relPath(file);
  if (BOLA_LEGITIMATE_EXCEPTIONS.has(rel)) return [];

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const findings: Finding[] = [];

  // Pattern : findUnique({ where: { id ... }) OU findOne / findFirst sans tenantId
  // dans le bloc where. Heuristique : ligne contient `findUnique(` / `findFirst(` /
  // `findOne(` ET les ~5 lignes suivantes n'ont pas `tenantId` adjacent.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/\.(findUnique|findFirst|findOne)\s*\(/);
    if (!m) continue;

    // Scan 0-8 lignes en avant pour bloc { where: { ... } }
    const window = lines.slice(i, Math.min(i + 8, lines.length)).join('\n');

    // Ignore si tenantId est mentionné dans la fenêtre
    if (/tenantId\s*[:,]/.test(window)) continue;

    // Ignore si la query est `where: { id: '<literal>' }` (lookup constant)
    if (/where:\s*\{\s*id:\s*['"][a-zA-Z0-9-_]+['"]\s*\}/.test(window)) continue;

    // Ignore si SYSTEM_CTX injecté (déjà bypass autorisé per ADR-021 §5)
    const ctxWindow = lines.slice(Math.max(0, i - 5), i).join('\n');
    if (/SYSTEM_CTX\(/.test(ctxWindow)) continue;

    findings.push({
      file: rel,
      line: i + 1,
      snippet: line.trim().slice(0, 120),
      pattern: m[1] as Finding['pattern'],
    });
  }

  return findings;
}

function main() {
  const mode = process.argv.includes('--strict') ? 'strict' : 'warn';
  const files = walk(ROOT);
  const allFindings: Finding[] = [];

  for (const f of files) {
    allFindings.push(...scan(f));
  }

  console.log(`check-bola.ts — Track E.4 Pass 2 (mode=${mode})`);
  console.log(`Scanned ${files.length} TypeScript files under ${relPath(ROOT)}`);
  console.log(`Whitelisted ${BOLA_LEGITIMATE_EXCEPTIONS.size} legitimate exception files\n`);

  if (allFindings.length === 0) {
    console.log('✓ 0 BOLA suspect pattern detected.');
    process.exit(0);
  }

  console.log(`⚠ ${allFindings.length} BOLA suspect pattern(s) detected:\n`);
  for (const f of allFindings) {
    console.log(`  ${f.file}:${f.line}  [${f.pattern}]  ${f.snippet}`);
  }
  console.log('');
  console.log('Pattern figé MCP `XCH_BOLA_PATTERN_CHECK` — toute lookup par ID externe DOIT scoper par tenantId.');
  console.log('Si finding est légitime (super-admin, setup, cron), ajouter le file dans BOLA_LEGITIMATE_EXCEPTIONS de ce script.');

  if (mode === 'strict') {
    process.exit(1);
  }
  // Mode warn baseline (Track E.4 Pass 2) : exit 0 toujours
  console.log('\n(mode=warn — exit 0. Promotion bloquant Track F si baseline = 0.)');
  process.exit(0);
}

main();
