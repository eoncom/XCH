import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTaskDto } from './dto/filter-task.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { StorageService } from '../../common/services/storage.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { NotificationEmitter } from '../notifications/notification-emitter';
import { UserNotificationService } from '../notifications/user-notification.service';
import { createId } from '@paralleldrive/cuid2';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaClient,
    private storageService: StorageService,
    private auditLogService: AuditLogService,
    private notificationEmitter: NotificationEmitter,
    private userNotificationService: UserNotificationService,
  ) {}

  async create(tenantId: string, userId: string, createTaskDto: CreateTaskDto) {
    const data: any = { ...createTaskDto, tenantId, createdBy: userId };

    // Validate assetId FK if provided
    if (data.assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: data.assetId, tenantId },
      });
      if (!asset) {
        delete data.assetId;
      }
    }
    if (data.assetId === '' || data.assetId === null) {
      data.assetId = null;
    }

    // Validate assignedTo FK if provided
    if (data.assignedTo && data.assignedTo !== '') {
      const assignedUser = await this.prisma.user.findFirst({
        where: { id: data.assignedTo, tenantId },
      });
      if (!assignedUser) {
        delete data.assignedTo;
      }
    }
    if (data.assignedTo === '' || data.assignedTo === null) {
      data.assignedTo = null;
    }

    const task = await this.prisma.task.create({
      data,
      include: {
        site: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        asset: {
          select: {
            id: true,
            type: true,
            model: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'CREATE',
        entityType: 'task',
        entityId: task.id,
        changes: { after: { title: task.title, status: task.status, priority: task.priority, siteId: task.siteId, assignedTo: task.assignedTo } },
      });
    } catch (e) {
      this.logger.warn(`Failed to write audit log for task ${task.id}: ${e.message}`);
    }

    // Notification: task assigned
    if (task.assignedUser) {
      this.notificationEmitter.taskAssigned({
        tenantId,
        task: { id: task.id, title: task.title, siteId: task.siteId },
        assignee: task.assignedUser,
        actor: task.creator || undefined,
      }).catch((e) => this.logger.warn(`Notification failed: ${e.message}`));

      // In-app inbox notification
      this.userNotificationService
        .create({
          tenantId,
          userId: task.assignedUser.id,
          type: 'TASK_ASSIGNED',
          title: `Tâche assignée : ${task.title}`,
          body: task.creator ? `Assignée par ${task.creator.name}` : undefined,
          link: `/dashboard/tasks/${task.id}`,
        })
        .catch((e) => this.logger.warn(`Inbox notification failed: ${e.message}`));
    }

    return task;
  }

  async findAll(tenantId: string, filter?: FilterTaskDto, accessibleSiteIds?: string[] | null): Promise<PaginatedResponse<any>> {
    const page = filter?.page ?? 1;
    const pageSize = filter?.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: any = { tenantId };

    // Site access filtering
    if (accessibleSiteIds !== undefined && accessibleSiteIds !== null) {
      if (accessibleSiteIds.length === 0) return buildPaginatedResponse([], 0, page, pageSize);
      where.siteId = { in: accessibleSiteIds };
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.priority) {
      where.priority = filter.priority;
    }

    if (filter?.siteId) {
      if (accessibleSiteIds && !accessibleSiteIds.includes(filter.siteId)) return buildPaginatedResponse([], 0, page, pageSize);
      where.siteId = filter.siteId;
    }

    if (filter?.assetId) {
      where.assetId = filter.assetId;
    }

    if (filter?.assignedTo) {
      where.assignedTo = filter.assignedTo;
    }

    if (filter?.unassigned === 'true') {
      where.assignedTo = null;
    }

    if (filter?.overdue === 'true') {
      where.dueDate = {
        lt: new Date(),
      };
      where.status = {
        notIn: ['DONE', 'CANCELLED'],
      };
    }

    if (filter?.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    // Determine sort order (default: createdAt desc)
    const allowedSortFields = ['createdAt', 'updatedAt', 'priority', 'status', 'dueDate', 'title'];
    const hasExplicitSort = filter?.sortBy && allowedSortFields.includes(filter.sortBy);
    const sortBy: string = hasExplicitSort ? filter.sortBy! : 'createdAt';
    const sortOrder = hasExplicitSort ? (filter?.sortOrder ?? 'desc') : 'desc';

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          site: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          asset: {
            select: {
              id: true,
              type: true,
              model: true,
            },
          },
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          checklistItems: {
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    // Format checklist pour compatibilité frontend
    const data = tasks.map(task => ({
      ...task,
      checklist: task.checklistItems.map(item => ({
        id: item.id,
        text: item.text,
        checked: item.checked,
        order: item.order,
      })),
    }));

    return buildPaginatedResponse(data, total, page, pageSize);
  }

  async findOne(id: string, tenantId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        site: true,
        asset: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        photos: true,
        checklistItems: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Calculate checklist completion
    let checklistCompletion = null;
    if (task.checklistItems && task.checklistItems.length > 0) {
      const total = task.checklistItems.length;
      const completed = task.checklistItems.filter(item => item.checked).length;
      checklistCompletion = {
        total,
        completed,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }

    // Format checklist pour compatibilité frontend (garde le même format que avant)
    const checklist = task.checklistItems.map(item => ({
      id: item.id,
      text: item.text,
      checked: item.checked,
      order: item.order,
    }));

    return {
      ...task,
      checklist, // Expose les items au format attendu par le frontend
      checklistCompletion,
    };
  }

  async update(id: string, tenantId: string, updateTaskDto: UpdateTaskDto, userId?: string) {
    const before = await this.prisma.task.findFirst({ where: { id, tenantId } });
    if (!before) {
      throw new NotFoundException('Task not found');
    }

    // Auto-complete task if status is DONE and no completedAt
    const data: any = { ...updateTaskDto };
    if (updateTaskDto.status === 'DONE' && !data.completedAt) {
      data.completedAt = new Date();
    }

    // Validate assetId FK if provided
    if (data.assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: data.assetId, tenantId },
      });
      if (!asset) {
        // If asset doesn't exist, remove assetId to avoid FK violation
        delete data.assetId;
      }
    }
    // Allow explicit null/empty to unlink asset
    if (data.assetId === '' || data.assetId === null) {
      data.assetId = null;
    }

    // Validate assignedTo FK if provided
    if (data.assignedTo && data.assignedTo !== '') {
      const assignedUser = await this.prisma.user.findFirst({
        where: { id: data.assignedTo, tenantId },
      });
      if (!assignedUser) {
        // If user doesn't exist, remove assignedTo to avoid FK violation
        delete data.assignedTo;
      }
    }
    // Allow explicit null/empty to unassign
    if (data.assignedTo === '' || data.assignedTo === null) {
      data.assignedTo = null;
    }

    const task = await this.prisma.task.update({
      where: { id },
      data,
      include: {
        site: true,
        asset: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Audit log with diff
    try {
      const changes = this.auditLogService.diffChanges(
        before as Record<string, any>,
        updateTaskDto as Record<string, any>,
      );
      if (changes) {
        await this.auditLogService.log({
          tenantId,
          userId,
          action: 'UPDATE',
          entityType: 'task',
          entityId: id,
          changes,
        });
      }
    } catch (e) {
      this.logger.warn(`Failed to write audit log for task ${id}: ${e.message}`);
    }

    // Notifications
    const actor = userId ? await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }) : undefined;

    // Task status changed
    if (updateTaskDto.status && updateTaskDto.status !== before.status) {
      this.notificationEmitter.taskStatusChanged({
        tenantId,
        task: { id: task.id, title: task.title, siteId: task.siteId },
        oldStatus: before.status,
        newStatus: updateTaskDto.status,
        actor: actor || undefined,
      }).catch((e) => this.logger.warn(`Notification failed: ${e.message}`));

      // In-app inbox notification — notify both the assignee and (if different) the creator.
      // Critical statuses (BLOCKED, CANCELLED) get a stronger title.
      const isCritical = updateTaskDto.status === 'BLOCKED' || updateTaskDto.status === 'CANCELLED';
      const title = isCritical
        ? `⚠ Tâche "${task.title}" : ${updateTaskDto.status}`
        : `Tâche "${task.title}" : ${before.status} → ${updateTaskDto.status}`;
      const body = actor ? `Modifié par ${actor.name}` : undefined;
      const link = `/dashboard/tasks/${task.id}`;
      const recipientIds = new Set<string>();
      if ((task as any).assignedTo) recipientIds.add((task as any).assignedTo);
      if ((task as any).createdBy && (task as any).createdBy !== (task as any).assignedTo) {
        recipientIds.add((task as any).createdBy);
      }
      for (const rid of recipientIds) {
        this.userNotificationService
          .create({
            tenantId,
            userId: rid,
            type: 'TASK_STATUS_CHANGED',
            title,
            body,
            link,
          })
          .catch((e) => this.logger.warn(`Inbox notification failed: ${e.message}`));
      }
    }

    // Task reassigned
    if (updateTaskDto.assignedTo && updateTaskDto.assignedTo !== before.assignedTo && task.assignedUser) {
      this.notificationEmitter.taskAssigned({
        tenantId,
        task: { id: task.id, title: task.title, siteId: task.siteId },
        assignee: task.assignedUser,
        actor: actor || undefined,
      }).catch((e) => this.logger.warn(`Notification failed: ${e.message}`));

      // In-app inbox notification
      this.userNotificationService
        .create({
          tenantId,
          userId: task.assignedUser.id,
          type: 'TASK_ASSIGNED',
          title: `Tâche assignée : ${task.title}`,
          body: actor ? `Assignée par ${actor.name}` : undefined,
          link: `/dashboard/tasks/${task.id}`,
        })
        .catch((e) => this.logger.warn(`Inbox notification failed: ${e.message}`));
    }

    return task;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const task = await this.findOne(id, tenantId);

    await this.prisma.task.delete({
      where: { id },
    });

    // Audit log
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'DELETE',
        entityType: 'task',
        entityId: id,
        changes: { before: { title: task.title, status: task.status, priority: task.priority, siteId: task.siteId, assignedTo: task.assignedTo } },
      });
    } catch (e) {
      this.logger.warn(`Failed to write audit log for task ${id}: ${e.message}`);
    }

    return { message: 'Task deleted successfully' };
  }

  async updateChecklist(id: string, tenantId: string, checklist: any[]) {
    const task = await this.findOne(id, tenantId);

    // Supprimer tous les items existants
    await this.prisma.taskChecklistItem.deleteMany({
      where: { taskId: id },
    });

    // Créer les nouveaux items
    if (checklist && checklist.length > 0) {
      await this.prisma.taskChecklistItem.createMany({
        data: checklist.map((item, index) => ({
          taskId: id,
          text: item.text,
          checked: item.checked || false,
          order: item.order !== undefined ? item.order : index + 1,
        })),
      });
    }

    // Retourner la tâche avec les items mis à jour
    return this.findOne(id, tenantId);
  }

  async getStatsByStatus(tenantId: string, accessibleSiteIds?: string[] | null) {
    const where: any = { tenantId };
    if (accessibleSiteIds !== undefined && accessibleSiteIds !== null) {
      if (accessibleSiteIds.length === 0) return [];
      where.siteId = { in: accessibleSiteIds };
    }

    const stats = await this.prisma.task.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
    });

    return stats;
  }

  async getStatsByPriority(tenantId: string, accessibleSiteIds?: string[] | null) {
    const where: any = { tenantId };
    if (accessibleSiteIds !== undefined && accessibleSiteIds !== null) {
      if (accessibleSiteIds.length === 0) return [];
      where.siteId = { in: accessibleSiteIds };
    }

    const stats = await this.prisma.task.groupBy({
      by: ['priority'],
      where,
      _count: {
        priority: true,
      },
    });

    return stats;
  }

  async getMyTasks(tenantId: string, userId: string, accessibleSiteIds?: string[] | null) {
    return this.findAll(tenantId, { assignedTo: userId }, accessibleSiteIds);
  }

  async getOverdueTasks(tenantId: string, accessibleSiteIds?: string[] | null) {
    return this.findAll(tenantId, { overdue: 'true' }, accessibleSiteIds);
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  async uploadAttachment(
    taskId: string,
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    dto: UploadAttachmentDto,
  ) {
    // Verify task exists
    await this.findOne(taskId, tenantId);

    // Generate unique filename
    const filename = this.storageService.generateFilename(file.originalname, 'attachment');
    const folder = `attachments/${tenantId}/tasks/${taskId}`;

    // Upload to storage
    const filePath = await this.storageService.uploadFile(file, folder, filename);

    // Create database entry
    const attachment = await this.prisma.attachment.create({
      data: {
        id: createId(),
        tenantId,
        taskId,
        filename,
        originalFilename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: filePath,
        description: dto.description,
        category: dto.category,
        uploadedBy: userId,
      },
    });

    // Get file URL
    const url = this.storageService.getFileUrl(filePath);

    return {
      ...attachment,
      url,
    };
  }

  async listAttachments(taskId: string, tenantId: string) {
    // Verify task exists
    await this.findOne(taskId, tenantId);

    const attachments = await this.prisma.attachment.findMany({
      where: {
        tenantId,
        taskId,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    // Add URLs to all attachments
    const attachmentsWithUrls = attachments.map((attachment) => ({
      ...attachment,
      url: this.storageService.getFileUrl(attachment.path),
    }));

    return attachmentsWithUrls;
  }

  async deleteAttachment(attachmentId: string, tenantId: string, taskId: string) {
    // Verify attachment exists and belongs to tenant/task
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        tenantId,
        taskId,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Delete from storage
    await this.storageService.deleteFile(attachment.path);

    // Delete from database
    await this.prisma.attachment.delete({
      where: { id: attachmentId },
    });

    return { message: 'Attachment deleted successfully' };
  }

  // ============================================================================
  // COMMENTS
  // ============================================================================

  async createComment(taskId: string, tenantId: string, userId: string, dto: CreateCommentDto) {
    // Verify task exists and belongs to tenant
    await this.findOne(taskId, tenantId);

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        authorId: userId,
        text: dto.text,
        isSystem: dto.isSystem || false,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return comment;
  }

  async getComments(taskId: string, tenantId: string) {
    // Verify task exists and belongs to tenant
    await this.findOne(taskId, tenantId);

    const comments = await this.prisma.taskComment.findMany({
      where: { taskId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  }

  async updateComment(commentId: string, tenantId: string, userId: string, text: string, userRole: string) {
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId },
      include: {
        task: { select: { tenantId: true } },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.task.tenantId !== tenantId) {
      throw new NotFoundException('Comment not found');
    }

    // Only the author or ADMIN can edit
    if (comment.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres commentaires');
    }

    return this.prisma.taskComment.update({
      where: { id: commentId },
      data: { text },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async deleteComment(commentId: string, tenantId: string, userId: string, userRole: string) {
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId },
      include: {
        task: { select: { tenantId: true } },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.task.tenantId !== tenantId) {
      throw new NotFoundException('Comment not found');
    }

    // Only the author or ADMIN can delete
    if (comment.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres commentaires');
    }

    await this.prisma.taskComment.delete({
      where: { id: commentId },
    });

    return { message: 'Comment deleted successfully' };
  }

  /**
   * Add a system comment when task status changes to BLOCKED
   * Requires a blocking reason
   */
  async addBlockingReason(taskId: string, tenantId: string, userId: string, reason: string) {
    return this.createComment(taskId, tenantId, userId, {
      text: `⛔ Raison du blocage : ${reason}`,
      isSystem: true,
    });
  }
}
