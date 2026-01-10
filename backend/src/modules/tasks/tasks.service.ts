import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTaskDto } from './dto/filter-task.dto';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaClient) {}

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
}
