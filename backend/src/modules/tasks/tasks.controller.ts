import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTaskDto } from './dto/filter-task.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';
import { SiteAccessService } from '../site-access/site-access.service';
import { ResourcePermissionLevel } from '../site-access/dto/grant-site-access.dto';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly siteAccessService: SiteAccessService,
  ) {}

  @Post()
  @Resource('tasks') @Action('create')
  @ApiOperation({ summary: 'Create new task' })
  async create(@Body() createTaskDto: CreateTaskDto, @Request() req: AuthRequest) {
    if (createTaskDto.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, createTaskDto.siteId, 'tasks',
      );
      if (perm !== ResourcePermissionLevel.WRITE) {
        throw new ForbiddenException('Insufficient permissions for tasks on this site');
      }
    }
    return this.tasksService.create(req.user.tenantId, req.user.id, createTaskDto);
  }

  @Get()
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get all tasks (filtered by user site access + resource permissions)' })
  async findAll(@Query() filter: FilterTaskDto, @Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIdsForResource(
      req.user.tenantId,
      req.user.userId,
      'tasks',
    );
    return this.tasksService.findAll(req.user.tenantId, filter, accessibleSiteIds);
  }

  @Get('my-tasks')
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get tasks assigned to me' })
  async getMyTasks(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIdsForResource(
      req.user.tenantId,
      req.user.userId,
      'tasks',
    );
    return this.tasksService.getMyTasks(req.user.tenantId, req.user.id, accessibleSiteIds);
  }

  @Get('overdue')
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get overdue tasks' })
  async getOverdueTasks(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIdsForResource(
      req.user.tenantId,
      req.user.userId,
      'tasks',
    );
    return this.tasksService.getOverdueTasks(req.user.tenantId, accessibleSiteIds);
  }

  @Get('stats/by-status')
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get tasks statistics by status' })
  async getStatsByStatus(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIdsForResource(
      req.user.tenantId,
      req.user.userId,
      'tasks',
    );
    return this.tasksService.getStatsByStatus(req.user.tenantId, accessibleSiteIds);
  }

  @Get('stats/by-priority')
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get tasks statistics by priority' })
  async getStatsByPriority(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIdsForResource(
      req.user.tenantId,
      req.user.userId,
      'tasks',
    );
    return this.tasksService.getStatsByPriority(req.user.tenantId, accessibleSiteIds);
  }

  @Get(':id')
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get task by id' })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    const task = await this.tasksService.findOne(id, req.user.tenantId);
    if (task.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, task.siteId, 'tasks',
      );
      if (perm === ResourcePermissionLevel.NONE) {
        throw new ForbiddenException('No access to tasks on this site');
      }
    }
    return task;
  }

  @Patch(':id')
  @Resource('tasks') @Action('update')
  @ApiOperation({ summary: 'Update task' })
  async update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto, @Request() req: AuthRequest) {
    const task = await this.tasksService.findOne(id, req.user.tenantId);
    if (task.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, task.siteId, 'tasks',
      );
      if (perm !== ResourcePermissionLevel.WRITE) {
        throw new ForbiddenException('Insufficient permissions to modify tasks on this site');
      }
    }
    return this.tasksService.update(id, req.user.tenantId, updateTaskDto);
  }

  @Patch(':id/checklist')
  @Resource('tasks') @Action('update')
  @ApiOperation({ summary: 'Update task checklist' })
  async updateChecklist(
    @Param('id') id: string,
    @Body() updateChecklistDto: UpdateChecklistDto,
    @Request() req: AuthRequest,
  ) {
    const task = await this.tasksService.findOne(id, req.user.tenantId);
    if (task.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, task.siteId, 'tasks',
      );
      if (perm !== ResourcePermissionLevel.WRITE) {
        throw new ForbiddenException('Insufficient permissions to modify tasks on this site');
      }
    }
    return this.tasksService.updateChecklist(id, req.user.tenantId, updateChecklistDto.checklist);
  }

  @Delete(':id')
  @Resource('tasks') @Action('delete')
  @ApiOperation({ summary: 'Delete task' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    const task = await this.tasksService.findOne(id, req.user.tenantId);
    if (task.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, task.siteId, 'tasks',
      );
      if (perm !== ResourcePermissionLevel.WRITE) {
        throw new ForbiddenException('Insufficient permissions to delete tasks on this site');
      }
    }
    return this.tasksService.remove(id, req.user.tenantId);
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  @Post(':id/attachments')
  @Resource('tasks') @Action('update')
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
  @UseInterceptors(FileInterceptor('file'))
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
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'List attachments for task' })
  listAttachments(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.tasksService.listAttachments(id, req.user.tenantId);
  }

  @Delete(':id/attachments/:attachmentId')
  @Resource('tasks') @Action('update')
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
  @Resource('tasks') @Action('update')
  @ApiOperation({ summary: 'Add comment to task' })
  createComment(
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
    @Request() req: AuthRequest,
  ) {
    return this.tasksService.createComment(id, req.user.tenantId, req.user.id, createCommentDto);
  }

  @Get(':id/comments')
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get comments for task' })
  getComments(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.tasksService.getComments(id, req.user.tenantId);
  }

  @Patch(':id/comments/:commentId')
  @Resource('tasks') @Action('update')
  @ApiOperation({ summary: 'Update comment' })
  updateComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: { text: string },
    @Request() req: AuthRequest,
  ) {
    return this.tasksService.updateComment(commentId, req.user.tenantId, req.user.id, body.text, req.user.role);
  }

  @Delete(':id/comments/:commentId')
  @Resource('tasks') @Action('update')
  @ApiOperation({ summary: 'Delete comment' })
  deleteComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Request() req: AuthRequest,
  ) {
    return this.tasksService.deleteComment(commentId, req.user.tenantId, req.user.id, req.user.role);
  }
}
