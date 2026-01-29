import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTaskDto } from './dto/filter-task.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { MinioService } from '../../common/services/minio.service';
import { cuid } from '@paralleldrive/cuid2';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaClient,
    private minioService: MinioService,
  ) {}

  async create(tenantId: string, userId: string, createTaskDto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        ...createTaskDto,
        tenantId,
        createdBy: userId,
      },
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

    return task;
  }

  async findAll(tenantId: string, filter?: FilterTaskDto) {
    const where: any = { tenantId };

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.priority) {
      where.priority = filter.priority;
    }

    if (filter?.siteId) {
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

    const tasks = await this.prisma.task.findMany({
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tasks;
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
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Calculate checklist completion
    let checklistCompletion = null;
    if (task.checklist && Array.isArray(task.checklist)) {
      const total = task.checklist.length;
      const completed = task.checklist.filter((item: any) => item.checked).length;
      checklistCompletion = {
        total,
        completed,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }

    return {
      ...task,
      checklistCompletion,
    };
  }

  async update(id: string, tenantId: string, updateTaskDto: UpdateTaskDto) {
    await this.findOne(id, tenantId);

    // Auto-complete task if status is DONE and no completedAt
    const data: any = { ...updateTaskDto };
    if (updateTaskDto.status === 'DONE' && !data.completedAt) {
      data.completedAt = new Date();
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

    return task;
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.task.delete({
      where: { id },
    });

    return { message: 'Task deleted successfully' };
  }

  async updateChecklist(id: string, tenantId: string, checklist: any[]) {
    await this.findOne(id, tenantId);

    const task = await this.prisma.task.update({
      where: { id },
      data: { checklist },
    });

    return task;
  }

  async getStatsByStatus(tenantId: string) {
    const stats = await this.prisma.task.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: {
        status: true,
      },
    });

    return stats;
  }

  async getStatsByPriority(tenantId: string) {
    const stats = await this.prisma.task.groupBy({
      by: ['priority'],
      where: { tenantId },
      _count: {
        priority: true,
      },
    });

    return stats;
  }

  async getMyTasks(tenantId: string, userId: string) {
    return this.findAll(tenantId, { assignedTo: userId });
  }

  async getOverdueTasks(tenantId: string) {
    return this.findAll(tenantId, { overdue: 'true' });
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
    const timestamp = Date.now();
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedFilename}`;
    const path = `attachments/${tenantId}/tasks/${taskId}/${filename}`;

    // Upload to MinIO
    await this.minioService.uploadFile(
      'attachments',
      path,
      file.buffer,
      file.size,
      file.mimetype,
    );

    // Create database entry
    const attachment = await this.prisma.attachment.create({
      data: {
        id: cuid(),
        tenantId,
        taskId,
        filename,
        originalFilename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path,
        description: dto.description,
        category: dto.category,
        uploadedBy: userId,
      },
    });

    // Generate presigned URL (7 days)
    const url = await this.minioService.getPresignedUrl('attachments', path, 7 * 24 * 60 * 60);

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

    // Generate presigned URLs for all attachments
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        const url = await this.minioService.getPresignedUrl(
          'attachments',
          attachment.path,
          7 * 24 * 60 * 60,
        );
        return {
          ...attachment,
          url,
        };
      }),
    );

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

    // Delete from MinIO
    await this.minioService.deleteFile('attachments', attachment.path);

    // Delete from database
    await this.prisma.attachment.delete({
      where: { id: attachmentId },
    });

    return { message: 'Attachment deleted successfully' };
  }
}
