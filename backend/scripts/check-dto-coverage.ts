#!/usr/bin/env node
/**
 * S9 ADR-023 — DTO coverage CI guard.
 *
 * Walks `backend/src/modules/`**`/*.controller.ts` and verifies every HTTP
 * decorator (`@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`) is paired with a
 * `@ApiResponse({ type })` / `@ApiOkResponse({ type })` /
 * `@ApiCreatedResponse({ type })` within a 10-line adjacency window.
 *
 * Endpoints not yet processed by the S9 cascade are listed in
 * `scripts/dto-coverage-baseline.json`. That allowlist shrinks PR-by-PR
 * and reaches `[]` when the whole cascade is complete (post-PR #16). The
 * baseline operates per-file: a controller path on the list is exempt.
 *
 * Exit codes :
 *   0 — coverage OK (or all violations covered by exemptions)
 *   1 — at least one un-exempted endpoint without DTO coverage
 *
 * Usage (CI) :
 *   npx ts-node backend/scripts/check-dto-coverage.ts
 *
 * Usage (local) :
 *   cd backend && npx ts-node scripts/check-dto-coverage.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface Baseline {
  exempted_files: string[];
  description?: string;
}

interface Endpoint {
  file: string;
  line: number;
  method: string;
  decoratorLine: string;
}

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULES_ROOT = path.join(REPO_ROOT, 'backend', 'src', 'modules');
const BASELINE_PATH = path.join(__dirname, 'dto-coverage-baseline.json');

const HTTP_DECORATOR_RE = /^\s*@(Get|Post|Put|Patch|Delete)\s*\(/;
const RESPONSE_DECORATOR_RE = /@(ApiResponse|ApiOkResponse|ApiCreatedResponse)\s*\(/;
const TYPE_PROP_RE = /\btype\s*:/;
const RES_PARAM_RE = /@Res\s*\(/;
// Window large enough to cover an `@Post` followed by a multi-line
// `@UseInterceptors(FileInterceptor(...))` block before the `@ApiOkResponse`.
// Tightening this rejects legitimate file-upload endpoints; loosening it
// makes the script too permissive. 20 is calibrated on backup + assets.
const ADJACENCY_WINDOW = 20;
// Endpoints that stream binary content via @Res() write directly to the
// Express response and have no JSON body. They still need an @ApiOkResponse
// decorator (description for Swagger), but `type:` is not applicable —
// the wire payload is `application/octet-stream` / `application/zip` etc.
// We look up to N lines after the HTTP decorator to spot @Res() in the
// method signature.
const RES_LOOKAHEAD = 25;

function listControllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listControllerFiles(p));
    } else if (entry.isFile() && entry.name.endsWith('.controller.ts')) {
      out.push(p);
    }
  }
  return out;
}

function findEndpoints(file: string): Endpoint[] {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const endpoints: Endpoint[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HTTP_DECORATOR_RE);
    if (m) {
      endpoints.push({
        file,
        line: i + 1,
        method: m[1],
        decoratorLine: lines[i].trim(),
      });
    }
  }
  return endpoints;
}

function isBinaryStreamEndpoint(file: string, line: number): boolean {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  // Look forward from the HTTP decorator until the opening method body
  // (line containing `{`) or the lookahead window — whichever is shorter.
  // If `@Res()` appears in that window, the endpoint streams a raw response
  // and is exempt from the `type:` requirement.
  const end = Math.min(lines.length - 1, line - 1 + RES_LOOKAHEAD);
  for (let i = line - 1; i <= end; i++) {
    const ln = lines[i] ?? '';
    if (RES_PARAM_RE.test(ln)) return true;
    if (ln.includes(') {')) break; // method body started
  }
  return false;
}

function hasResponseDtoCoverage(file: string, line: number): boolean {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const start = Math.max(0, line - 1 - ADJACENCY_WINDOW);
  const end = Math.min(lines.length, line - 1 + ADJACENCY_WINDOW);
  // Binary stream endpoints (@Res()) only need an @ApiOkResponse marker
  // for Swagger documentation — `type:` is N/A.
  if (isBinaryStreamEndpoint(file, line)) {
    for (let i = start; i <= end; i++) {
      if (RESPONSE_DECORATOR_RE.test(lines[i])) return true;
    }
    return false;
  }
  for (let i = start; i <= end; i++) {
    const slice = lines[i];
    if (RESPONSE_DECORATOR_RE.test(slice) && TYPE_PROP_RE.test(slice)) {
      return true;
    }
    // Multi-line decorators: detect opening @ApiOkResponse( on this line and
    // search until the matching closing paren or 5 lines down.
    if (RESPONSE_DECORATOR_RE.test(slice)) {
      const lookAhead = lines.slice(i, Math.min(lines.length, i + 6)).join(' ');
      if (TYPE_PROP_RE.test(lookAhead)) return true;
    }
  }
  return false;
}

function loadBaseline(): Baseline {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`::error::Baseline file missing: ${BASELINE_PATH}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (err) {
    console.error(`::error::Baseline JSON invalid: ${(err as Error).message}`);
    process.exit(1);
  }
}

function relativeFromRepo(p: string): string {
  return path.relative(REPO_ROOT, p).replace(/\\/g, '/');
}

function main() {
  const baseline = loadBaseline();
  const exemptedSet = new Set(baseline.exempted_files);
  const controllers = listControllerFiles(MODULES_ROOT).sort();

  let totalEndpoints = 0;
  let coveredCount = 0;
  let exemptedCount = 0;
  const violations: Endpoint[] = [];

  for (const file of controllers) {
    const rel = relativeFromRepo(file);
    const endpoints = findEndpoints(file);
    const isExempt = exemptedSet.has(rel);
    for (const ep of endpoints) {
      totalEndpoints++;
      const covered = hasResponseDtoCoverage(file, ep.line);
      if (covered) {
        coveredCount++;
      } else if (isExempt) {
        exemptedCount++;
      } else {
        violations.push(ep);
      }
    }
  }

  const totalControllers = controllers.length;
  const exemptControllers = controllers.filter((f) => exemptedSet.has(relativeFromRepo(f))).length;

  console.log(`\n=== DTO Coverage Check (S9 ADR-023) ===\n`);
  console.log(`Controllers scanned        : ${totalControllers}`);
  console.log(`Controllers exempted       : ${exemptControllers}`);
  console.log(`Endpoints total            : ${totalEndpoints}`);
  console.log(`Endpoints DTO-covered      : ${coveredCount}`);
  console.log(`Endpoints exempted         : ${exemptedCount}`);
  console.log(`Endpoints uncovered (FAIL) : ${violations.length}`);

  if (violations.length > 0) {
    console.log(`\n=== VIOLATIONS ===`);
    for (const v of violations) {
      console.log(
        `${relativeFromRepo(v.file)}:${v.line}  @${v.method}  → no @ApiResponse({ type:... }) within ${ADJACENCY_WINDOW} lines`,
      );
    }
    console.log(
      `\n::error::${violations.length} endpoint(s) missing @ApiResponse({ type }) coverage.`,
    );
    console.log(
      `Either add the decorator (preferred — finishes the S9 module migration) or, if temporarily, exempt the file in scripts/dto-coverage-baseline.json with a tracking issue.\n`,
    );
    process.exit(1);
  }

  console.log(`\nOK — every endpoint has DTO coverage (or is exempted).`);
  if (exemptControllers === 0) {
    console.log(`Baseline is empty → guard is fully strict. ADR-023 cascade complete.`);
  } else {
    console.log(
      `Baseline still exempts ${exemptControllers} controller(s). Continue the S9 cascade to shrink it to 0.`,
    );
  }
  process.exit(0);
}

main();
