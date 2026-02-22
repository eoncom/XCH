import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

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
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaClient) {}

  async log(entry: AuditLogEntry) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId || null,
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
