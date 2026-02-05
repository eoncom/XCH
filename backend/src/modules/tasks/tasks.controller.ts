import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTaskDto } from './dto/filter-task.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Resource('tasks') @Action('create')
  @ApiOperation({ summary: 'Create new task' })
  create(@Body() createTaskDto: CreateTaskDto, @Request() req: AuthRequest) {
    return this.tasksService.create(req.user.tenantId, req.user.id, createTaskDto);
  }

  @Get()
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get all tasks' })
  findAll(@Query() filter: FilterTaskDto, @Request() req: AuthRequest) {
    return this.tasksService.findAll(req.user.tenantId, filter);
  }

  @Get('my-tasks')
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get tasks assigned to me' })
  getMyTasks(@Request() req: AuthRequest) {
    return this.tasksService.getMyTasks(req.user.tenantId, req.user.id);
  }

  @Get('overdue')
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get overdue tasks' })
  getOverdueTasks(@Request() req: AuthRequest) {
    return this.tasksService.getOverdueTasks(req.user.tenantId);
  }

  @Get('stats/by-status')
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get tasks statistics by status' })
  getStatsByStatus(@Request() req: AuthRequest) {
    return this.tasksService.getStatsByStatus(req.user.tenantId);
  }

  @Get('stats/by-priority')
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get tasks statistics by priority' })
  getStatsByPriority(@Request() req: AuthRequest) {
    return this.tasksService.getStatsByPriority(req.user.tenantId);
  }

  @Get(':id')
  @Resource('tasks') @Action('read')
  @ApiOperation({ summary: 'Get task by id' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.tasksService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Resource('tasks') @Action('update')
  @ApiOperation({ summary: 'Update task' })
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto, @Request() req: AuthRequest) {
    return this.tasksService.update(id, req.user.tenantId, updateTaskDto);
  }

  @Patch(':id/checklist')
  @Resource('tasks') @Action('update')
  @ApiOperation({ summary: 'Update task checklist' })
  updateChecklist(
    @Param('id') id: string,
    @Body() body: any,  // Raw body sans transformation
    @Request() req: AuthRequest,
  ) {
    return this.tasksService.updateChecklist(id, req.user.tenantId, body.checklist);
  }

  @Delete(':id')
  @Resource('tasks') @Action('delete')
  @ApiOperation({ summary: 'Delete task' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
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
}
