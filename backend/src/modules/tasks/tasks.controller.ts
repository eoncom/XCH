import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { attachmentFileFilter } from '../../common/utils/upload-security';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTaskDto } from './dto/filter-task.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';
import { PermissionService } from '../../common/services/permission.service';
import { ExpensesService } from '../expenses/expenses.service';

@RequireModule('tasks')
@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, ModuleGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly permissionService: PermissionService,
    private readonly expensesService: ExpensesService,
  ) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create new task' })
  async create(@Body() createTaskDto: CreateTaskDto, @Request() req: AuthRequest) {
    if (createTaskDto.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, createTaskDto.siteId, 'tasks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions for tasks on this site');
      }
    }
    return this.tasksService.create(req.user.tenantId, req.user.id, createTaskDto);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Get all tasks (filtered by user site access + resource permissions)' })
  async findAll(@Query() filter: FilterTaskDto, @Request() req: AuthRequest) {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.tasksService.findAll(req.user.tenantId, filter, accessibleSiteIds);
  }

  @Get('my-tasks')
  @RequireRead()
  @ApiOperation({ summary: 'Get tasks assigned to me' })
  async getMyTasks(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.tasksService.getMyTasks(req.user.tenantId, req.user.id, accessibleSiteIds);
  }

  @Get('overdue')
  @RequireRead()
  @ApiOperation({ summary: 'Get overdue tasks' })
  async getOverdueTasks(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.tasksService.getOverdueTasks(req.user.tenantId, accessibleSiteIds);
  }

  @Get('stats/by-status')
  @RequireRead()
  @ApiOperation({ summary: 'Get tasks statistics by status' })
  async getStatsByStatus(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.tasksService.getStatsByStatus(req.user.tenantId, accessibleSiteIds);
  }

  @Get('stats/by-priority')
  @RequireRead()
  @ApiOperation({ summary: 'Get tasks statistics by priority' })
  async getStatsByPriority(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.tasksService.getStatsByPriority(req.user.tenantId, accessibleSiteIds);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get task by id' })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const task = await this.tasksService.findOne(id, req.user.tenantId, ctx);
    if (task.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, task.siteId, 'tasks', req.user.tenantId,
      );
      if (perm === null) {
        throw new ForbiddenException('No access to tasks on this site');
      }
    }
    return task;
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update task' })
  async update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const task = await this.tasksService.findOne(id, req.user.tenantId, ctx);
    if (task.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, task.siteId, 'tasks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify tasks on this site');
      }
    }
    return this.tasksService.update(id, req.user.tenantId, updateTaskDto, req.user.userId, ctx);
  }

  @Patch(':id/checklist')
  @RequireWrite()
  @ApiOperation({ summary: 'Update task checklist' })
  async updateChecklist(
    @Param('id') id: string,
    @Body() updateChecklistDto: UpdateChecklistDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    const task = await this.tasksService.findOne(id, req.user.tenantId, ctx);
    if (task.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, task.siteId, 'tasks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify tasks on this site');
      }
    }
    return this.tasksService.updateChecklist(id, req.user.tenantId, updateChecklistDto.checklist);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete task' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const task = await this.tasksService.findOne(id, req.user.tenantId, ctx);
    if (task.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, task.siteId, 'tasks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to delete tasks on this site');
      }
    }
    return this.tasksService.remove(id, req.user.tenantId, req.user.userId, ctx);
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  @Post(':id/attachments')
  @RequireWrite()
  @ApiOperation({ summary: 'Upload attachment to task' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        description: {
          type: 'string',
        },
        category: {
          type: 'string',
          enum: ['spec', 'invoice', 'photo', 'report', 'manual', 'other'],
        },
      },
    },
  })
  // S1-closing (ADR-016 lot M) — limits + fileFilter were missing on this
  // endpoint, leaving it as a DoS / arbitrary upload vector.
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB, same as assets/sites/racks
      fileFilter: attachmentFileFilter,
    }),
  )
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadAttachmentDto: UploadAttachmentDto,
    @Request() req: AuthRequest,
  ) {
    return this.tasksService.uploadAttachment(
      id,
      req.user.tenantId,
      req.user.userId,
      file,
      uploadAttachmentDto,
    );
  }

  @Get(':id/attachments')
  @RequireRead()
  @ApiOperation({ summary: 'List attachments for task' })
  listAttachments(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.tasksService.listAttachments(id, req.user.tenantId);
  }

  @Delete(':id/attachments/:attachmentId')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete attachment from task' })
  deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: AuthRequest,
  ) {
    return this.tasksService.deleteAttachment(attachmentId, req.user.tenantId, id);
  }

  // ============================================================================
  // COMMENTS
  // ============================================================================

  @Post(':id/comments')
  @RequireWrite()
  @ApiOperation({ summary: 'Add comment to task' })
  createComment(
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
    @Request() req: AuthRequest,
  ) {
    return this.tasksService.createComment(id, req.user.tenantId, req.user.id, createCommentDto);
  }

  @Get(':id/comments')
  @RequireRead()
  @ApiOperation({ summary: 'Get comments for task' })
  getComments(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.tasksService.getComments(id, req.user.tenantId);
  }

  @Patch(':id/comments/:commentId')
  @RequireWrite()
  @ApiOperation({ summary: 'Update comment' })
  updateComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: { text: string },
    @Request() req: AuthRequest,
  ) {
    const localRole = (req as any).localRole || (req.user.isSuperAdmin ? 'ADMIN' : 'VIEWER');
    return this.tasksService.updateComment(commentId, req.user.tenantId, req.user.id, body.text, localRole);
  }

  @Delete(':id/comments/:commentId')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete comment' })
  deleteComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Request() req: AuthRequest,
  ) {
    const localRole = (req as any).localRole || (req.user.isSuperAdmin ? 'ADMIN' : 'VIEWER');
    return this.tasksService.deleteComment(commentId, req.user.tenantId, req.user.id, localRole);
  }

  // ========== ADR-011 Inline Expense generation ==========

  /**
   * Generate an Expense (SERVICE / ONE_TIME) from this task's actualCost
   * (or estimatedCost when useEstimated=true). 1:1 relationship — refuses
   * if the task already has an expense linked.
   */
  @Post(':id/generate-expense')
  @RequireWrite()
  @ApiOperation({
    summary:
      'Generate an Expense linked to this task (ADR-011). Validates that the caller has WRITE on the task site.',
  })
  async generateExpense(
    @Param('id') id: string,
    @Body() body: { bearerId: string; label?: string; useEstimated?: boolean },
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    const task = await this.tasksService.findOne(id, req.user.tenantId, ctx);
    if (task.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, task.siteId, 'expenses', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to create expenses on this site');
      }
    }
    return this.expensesService.createFromTask(
      req.user.tenantId,
      id,
      { ...body, fallbackDelegationId: req.delegationId },
      req.user.id,
    );
  }

  /**
   * Resync the linked Expense's totalAmount from the current task cost
   * (frozen-by-default, ADR-011 §2).
   */
  @Patch(':id/resync-expense')
  @RequireWrite()
  @ApiOperation({ summary: 'Resync linked expense from task cost (ADR-011)' })
  async resyncExpense(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    const task = await this.tasksService.findOne(id, req.user.tenantId, ctx);
    if (!(task as any).expenseId) {
      throw new BadRequestException('No expense linked to this task');
    }
    if (task.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, task.siteId, 'expenses', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to edit expenses on this site');
      }
    }
    return this.expensesService.resyncExpense(req.user.tenantId, (task as any).expenseId, {
      kind: 'task',
      sourceId: id,
    });
  }
}
