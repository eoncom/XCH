import { ClassConstructor, plainToInstance } from 'class-transformer';

/**
 * Context passed (optionally) as the 2nd parameter of every `to<X>ResponseDto`
 * Cas B helper. Intentionally empty for the S9 baseline — PRs of the cascade
 * extend it as concrete needs surface (RBAC partial reveal, tenant-specific
 * feature flags, locale-aware enum labels, etc.).
 *
 * Convention (cf `common/dto/response/README.md`) :
 *
 *   export function to<X>ResponseDto(
 *     input: <ServiceReturnShape>,
 *     ctx?: ResponseMappingCtx,
 *   ): <X>ResponseDto { ... }
 *
 * Always 2nd position, always optional, never a 3rd parameter — extend the
 * interface instead.
 */
export interface ResponseMappingCtx {
  // intentionally empty placeholder — extended in cascade PRs.
}

/**
 * Wrapper around `class-transformer.plainToInstance` that enforces the
 * canonical S9 Hardening tail mapping discipline (ADR-023 §3) :
 *
 *  - `excludeExtraneousValues: true` — anything not explicitly `@Expose()`d
 *    on the DTO is dropped. This is the anti-leak guarantee.
 *  - `enableImplicitConversion: true` — Date / number / boolean coercion
 *    matches the `transformOptions` already set in `main.ts`'s ValidationPipe.
 *
 * Use this helper instead of calling `plainToInstance` directly so future
 * audits only need to inspect a single point of policy.
 *
 * For the helper-manual flavor (Cas B in `common/dto/response/README.md`),
 * controllers may construct the DTO inline (`return { count: result.count }`)
 * or via a `to<X>ResponseDto` function colocated with the DTO class.
 */
export function toResponse<T>(cls: ClassConstructor<T>, plain: unknown): T {
  return plainToInstance(cls, plain, {
    excludeExtraneousValues: true,
    enableImplicitConversion: true,
  });
}

/**
 * Array variant. Always returns a fresh array, never mutates the input.
 */
export function toResponseArray<T>(cls: ClassConstructor<T>, plain: unknown[]): T[] {
  return plain.map((p) => toResponse(cls, p));
}
