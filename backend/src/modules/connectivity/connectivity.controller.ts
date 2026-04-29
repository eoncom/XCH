import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConnectivityService } from './connectivity.service';
import {
  CreateConnectivityLinkDto,
  UpdateConnectivityLinkDto,
  FilterConnectivityLinkDto,
} from './dto/create-connectivity-link.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead, RequireManage } from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';
import { ExpensesService } from '../expenses/expenses.service';
import { BadRequestException } from '@nestjs/common';

@ApiTags('connectivity')
@Controller('connectivity')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConnectivityController {
  constructor(
    private readonly service: ConnectivityService,
    private readonly expensesService: ExpensesService,
  ) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create a connectivity link' })
  create(
    @Body() dto: CreateConnectivityLinkDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.create(req.user.tenantId, dto, ctx);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'List connectivity links (filter by siteId/role/type)' })
  findAll(
    @Query() filters: FilterConnectivityLinkDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.findAll(req.user.tenantId, filters, ctx);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get a connectivity link' })
  findOne(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.findOne(req.user.tenantId, id, ctx);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update a connectivity link' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateConnectivityLinkDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.update(req.user.tenantId, id, dto, ctx);
  }

  @Delete(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete a connectivity link' })
  remove(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.remove(req.user.tenantId, id, ctx);
  }

  @Post(':id/generate-expense')
  @RequireWrite()
  @ApiOperation({ summary: 'Generate a recurring MONTHLY expense from this connectivity link' })
  generateExpense(
    @Param('id') id: string,
    @Body() body: { bearerId: string; label?: string },
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.generateExpense(req.user.tenantId, id, body, req.user.id, ctx);
  }

  /**
   * Resync the linked Expense's totalAmount from the current monthlyPrice
   * (frozen-by-default policy, ADR-011 §2). Returns { expense, before, after }.
   */
  @Patch(':id/resync-expense')
  @RequireWrite()
  @ApiOperation({ summary: 'Resync linked expense from connectivity monthly price (ADR-011)' })
  async resyncExpense(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    const link = await this.service.findOne(req.user.tenantId, id, ctx);
    if (!(link as any).expenseId) {
      throw new BadRequestException('No expense linked to this connectivity link');
    }
    return this.expensesService.resyncExpense(req.user.tenantId, (link as any).expenseId, {
      kind: 'connectivity',
      sourceId: id,
    });
  }
}
