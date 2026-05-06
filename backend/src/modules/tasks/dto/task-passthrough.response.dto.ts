import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Multi-class file documented exception (cf README) — module-scoped
 * Swagger marker DTOs for the tasks module.
 *
 * IMPORTANT — these DTOs are NOT used at runtime via `toResponse()`. They
 * are pure Swagger markers : controllers return service results directly
 * (no class instance), so ClassSerializerInterceptor leaves the payload
 * untouched.
 *
 * Rationale : Task entity carries many relations (assignedTo / site /
 * attachments / comments / checklist JSON / expense link) and the cost-
 * tracking + checklist UIs already consume the existing wire shape. Full
 * strict typing would require ~10 sub-DTOs per relation tree level — out
 * of scope for the v1.11.0 vague B finalisation. Future tightening : a
 * dedicated `tasks-strict-dto.md` ADR can land post-v2.0.0.
 *
 * Anti-leak guarantees come from the service layer (Prisma `select`
 * directives + explicit shape construction). No `passwordHash` or other
 * critical fields are reachable via Task relations.
 */

export class TaskResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;

  @ApiProperty({ description: 'TaskStatus enum' })
  status!: string;

  @ApiProperty({ description: 'TaskPriority enum' })
  priority!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  assignedTo?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  siteId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  dueDate?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  startDate?: Date | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  estimatedCost?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  actualCost?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  expenseId?: string | null;

  @ApiPropertyOptional({ description: 'Checklist items array (JSON)' })
  checklist?: unknown;

  @ApiPropertyOptional({ description: 'Site reference (passthrough)' })
  site?: unknown;

  @ApiPropertyOptional({ description: 'Assigned user reference (passthrough)' })
  assignee?: unknown;

  @ApiPropertyOptional({ description: 'Attachments array (passthrough)' })
  attachments?: unknown;

  @ApiPropertyOptional({ description: 'Comments array (passthrough)' })
  comments?: unknown;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class TaskListPageMetaResponseDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  totalPages!: number;
}

export class TaskListResponseDto {
  @ApiProperty({ type: () => [TaskResponseDto] })
  data!: TaskResponseDto[];

  @ApiProperty({ type: () => TaskListPageMetaResponseDto })
  meta!: TaskListPageMetaResponseDto;
}

export class TaskStatsByStatusResponseDto {
  @ApiProperty({
    description: 'Per-status count map (TODO / IN_PROGRESS / DONE / …)',
  })
  data?: unknown;
}

export class TaskStatsByPriorityResponseDto {
  @ApiProperty({
    description: 'Per-priority count map (LOW / MEDIUM / HIGH / URGENT)',
  })
  data?: unknown;
}

export class TaskAttachmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  filename!: string;

  @ApiProperty()
  originalFilename!: string;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  mimetype!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  category?: string | null;

  @ApiProperty()
  uploadedBy!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  uploadedAt!: Date;

  @ApiProperty({ description: 'Computed download URL' })
  url!: string;
}

export class TaskCommentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  taskId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'User reference (passthrough)' })
  user?: unknown;
}

export class TaskDeletedResultResponseDto {
  @ApiProperty()
  message!: string;
}

export class TaskAttachmentDeletedResultResponseDto {
  @ApiProperty()
  message!: string;
}

export class TaskCommentDeletedResultResponseDto {
  @ApiProperty()
  message!: string;
}

export class TaskExpenseResultResponseDto {
  @ApiProperty({
    description: 'Generated/resynced expense + before/after for resync',
  })
  data?: unknown;
}
