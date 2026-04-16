import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface AuditQuery {
  entity?: string;
  entityId?: string;
  userId?: string;
  action?: 'CREATE' | 'UPDATE' | 'DELETE';
  from?: string; // ISO
  to?: string; // ISO
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaClient) {}

  async query(tenantId: string, q: AuditQuery) {
    const page = Math.max(q.page || 1, 1);
    const pageSize = Math.min(Math.max(q.pageSize || 50, 1), 200);
    const skip = (page - 1) * pageSize;

    const where: any = { tenantId };
    if (q.entity) where.entityType = q.entity;
    if (q.entityId) where.entityId = q.entityId;
    if (q.userId) where.userId = q.userId;
    if (q.action) where.action = q.action;
    if (q.from || q.to) {
      where.timestamp = {};
      if (q.from) where.timestamp.gte = new Date(q.from);
      if (q.to) where.timestamp.lte = new Date(q.to);
    }

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
