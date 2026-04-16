import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface CreateUserNotificationDto {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/**
 * In-app notification inbox service.
 * - CRUD on UserNotification
 * - Cron jobs for warranty expiring + tasks due soon
 */
@Injectable()
export class UserNotificationService {
  private readonly logger = new Logger(UserNotificationService.name);

  constructor(private prisma: PrismaClient) {}

  async create(dto: CreateUserNotificationDto) {
    return this.prisma.userNotification.create({
      data: {
        tenantId: dto.tenantId,
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        link: dto.link,
      },
    });
  }

  async listForUser(
    userId: string,
    tenantId: string,
    unreadOnly = false,
    limit = 50,
  ) {
    return this.prisma.userNotification.findMany({
      where: {
        userId,
        tenantId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async countUnread(userId: string, tenantId: string) {
    const count = await this.prisma.userNotification.count({
      where: { userId, tenantId, readAt: null },
    });
    return { count };
  }

  async markRead(id: string, userId: string, tenantId: string) {
    const notif = await this.prisma.userNotification.findFirst({
      where: { id, userId, tenantId },
    });
    if (!notif) return null;
    if (notif.readAt) return notif;
    return this.prisma.userNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string, tenantId: string) {
    const res = await this.prisma.userNotification.updateMany({
      where: { userId, tenantId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  async remove(id: string, userId: string, tenantId: string) {
    const notif = await this.prisma.userNotification.findFirst({
      where: { id, userId, tenantId },
    });
    if (!notif) return { deleted: 0 };
    await this.prisma.userNotification.delete({ where: { id } });
    return { deleted: 1 };
  }

  // ───────────────── CRON ─────────────────

  /**
   * Each day at 08:00 — create WARRANTY_EXPIRING notifications for assets
   * whose warranty ends within the next 30 days. One notification per asset
   * per recipient, deduplicated on (userId, type, link).
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async cronWarrantyExpiring() {
    try {
      const now = new Date();
      const horizon = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

      const assets = await this.prisma.asset.findMany({
        where: {
          warrantyEnd: { not: null, gte: now, lte: horizon },
        },
        select: {
          id: true,
          tenantId: true,
          name: true,
          serialNumber: true,
          warrantyEnd: true,
          siteId: true,
        },
      });

      for (const a of assets) {
        // Deliver to all MANAGE users of the tenant (simple heuristic)
        const users = await this.prisma.user.findMany({
          where: {
            tenantId: a.tenantId,
            active: true,
            OR: [
              { isSuperAdmin: true },
              {
                userDelegations: {
                  some: { right: { in: ['MANAGE', 'WRITE'] } },
                },
              },
            ],
          },
          select: { id: true },
        });

        const link = `/dashboard/assets/${a.id}`;
        const title = `Garantie bientôt expirée : ${a.name || a.serialNumber || a.id}`;
        const body = a.warrantyEnd
          ? `Expire le ${a.warrantyEnd.toISOString().slice(0, 10)}`
          : undefined;

        for (const u of users) {
          const exists = await this.prisma.userNotification.findFirst({
            where: {
              userId: u.id,
              tenantId: a.tenantId,
              type: 'WARRANTY_EXPIRING',
              link,
              readAt: null,
            },
            select: { id: true },
          });
          if (exists) continue;
          await this.prisma.userNotification.create({
            data: {
              tenantId: a.tenantId,
              userId: u.id,
              type: 'WARRANTY_EXPIRING',
              title,
              body,
              link,
            },
          });
        }
      }
      this.logger.log(`cronWarrantyExpiring: scanned ${assets.length} assets`);
    } catch (e: any) {
      this.logger.error(`cronWarrantyExpiring failed: ${e.message}`);
    }
  }

  /**
   * Each day at 08:05 — tasks due within 2 days → notify assignee.
   */
  @Cron('5 8 * * *')
  async cronTasksDueSoon() {
    try {
      const now = new Date();
      const horizon = new Date(now.getTime() + 2 * 24 * 3600 * 1000);

      const tasks = await this.prisma.task.findMany({
        where: {
          dueDate: { not: null, gte: now, lte: horizon },
          assignedTo: { not: null },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
        select: {
          id: true,
          tenantId: true,
          title: true,
          dueDate: true,
          assignedTo: true,
        },
      });

      for (const t of tasks) {
        if (!t.assignedTo) continue;
        const link = `/dashboard/tasks/${t.id}`;
        const exists = await this.prisma.userNotification.findFirst({
          where: {
            userId: t.assignedTo,
            tenantId: t.tenantId,
            type: 'TASK_DUE_SOON',
            link,
            readAt: null,
          },
          select: { id: true },
        });
        if (exists) continue;
        await this.prisma.userNotification.create({
          data: {
            tenantId: t.tenantId,
            userId: t.assignedTo,
            type: 'TASK_DUE_SOON',
            title: `Tâche bientôt échue : ${t.title}`,
            body: t.dueDate
              ? `À traiter avant le ${t.dueDate.toISOString().slice(0, 10)}`
              : undefined,
            link,
          },
        });
      }
      this.logger.log(`cronTasksDueSoon: scanned ${tasks.length} tasks`);
    } catch (e: any) {
      this.logger.error(`cronTasksDueSoon failed: ${e.message}`);
    }
  }
}
