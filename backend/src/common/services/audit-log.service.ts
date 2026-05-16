import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { CallerCtx } from '../types/caller-ctx.interface';

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId?: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  /**
   * ADR-028 §B.0 nullability taxonomy figée :
   * - null légitime pour Cat 1 super-admin / Cat 2 pre-delegation / Cat 5 dev-test / SYSTEM_CTX
   * - capture `ctx.activeDelegationId` Option A pour Cat 3 self-scoped + Cat 4 catalog
   * - non-null obligatoire pour endpoints délégation-scoped (6 services ADR-021 §1)
   */
  delegationId?: string | null;
  /** ADR-028 §B.1 — capture systémique via @CallerCtxParam() (normalisé IPv4-mapped IPv6). */
  ipAddress?: string | null;
  /** ADR-028 §B.1 — capture systémique via @CallerCtxParam(). */
  userAgent?: string | null;
}

/**
 * Helper pour construire un `Partial<AuditLogEntry>` à partir d'un `CallerCtx`.
 * Pattern recommandé Track E.4 Pass 1 partie B.3 propagation :
 *
 * ```ts
 * await this.auditLogService.log({
 *   tenantId, userId, action: 'CREATE', entityType: 'site', entityId: site.id,
 *   changes: { after: ... },
 *   ...auditCtxFrom(ctx),  // delegationId + ipAddress + userAgent
 * });
 * ```
 *
 * Pour SYSTEM_CTX, le helper retourne `{ delegationId: null, ipAddress: null, userAgent: null }`
 * (cohérent ADR-028 §B.0 mapping SYSTEM_CTX → null légitime).
 */
export function auditCtxFrom(
  ctx: Pick<CallerCtx, 'activeDelegationId' | 'ipAddress' | 'userAgent'>,
): Pick<AuditLogEntry, 'delegationId' | 'ipAddress' | 'userAgent'> {
  return {
    delegationId: ctx.activeDelegationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  };
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaClient) {}

  async log(entry: AuditLogEntry) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId || null,
        delegationId: entry.delegationId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId || null,
        changes: entry.changes ? (entry.changes as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
      },
    });
  }

  async findByEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
    limit = 50,
  ) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return logs;
  }

  /**
   * Compare two objects and return only the changed fields.
   * Returns { before: {field: oldValue}, after: {field: newValue} }
   */
  diffChanges(
    before: Record<string, any>,
    after: Record<string, any>,
    fieldsToTrack?: string[],
  ): { before: Record<string, any>; after: Record<string, any> } | null {
    const changedBefore: Record<string, any> = {};
    const changedAfter: Record<string, any> = {};

    const keys = fieldsToTrack || Object.keys(after);

    for (const key of keys) {
      // Skip internal fields
      if (['updatedAt', 'createdAt', 'tenantId'].includes(key)) continue;

      const oldVal = before[key];
      const newVal = after[key];

      // Compare JSON stringified for objects/arrays
      const oldStr = JSON.stringify(oldVal);
      const newStr = JSON.stringify(newVal);

      if (oldStr !== newStr && newVal !== undefined) {
        changedBefore[key] = oldVal;
        changedAfter[key] = newVal;
      }
    }

    if (Object.keys(changedAfter).length === 0) return null;

    return { before: changedBefore, after: changedAfter };
  }
}
