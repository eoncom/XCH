import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { ConnectivityService } from './connectivity.service';
import {
  CreateConnectivityLinkDto,
  UpdateConnectivityLinkDto,
  FilterConnectivityLinkDto,
} from './dto/create-connectivity-link.dto';
import {
  ConnectivityLinkResponseDto,
  ConnectivityResyncExpenseResponseDto,
} from './dto/connectivity-link.response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead, RequireManage } from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';
import { ExpensesService } from '../expenses/expenses.service';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { DeletedResponseDto } from '../../common/dto/response';

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
  @ApiCreatedResponse({ type: ConnectivityLinkResponseDto })
  async create(
    @Body() dto: CreateConnectivityLinkDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ConnectivityLinkResponseDto> {
    const link = await this.service.create(req.user.tenantId, dto, ctx);
    return toResponse(ConnectivityLinkResponseDto, link);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'List connectivity links (filter by siteId/role/type)' })
  @ApiOkResponse({ type: ConnectivityLinkResponseDto, isArray: true })
  async findAll(
    @Query() filters: FilterConnectivityLinkDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ConnectivityLinkResponseDto[]> {
    const links = await this.service.findAll(req.user.tenantId, filters, ctx);
    return toResponseArray(ConnectivityLinkResponseDto, links);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get a connectivity link' })
  @ApiOkResponse({ type: ConnectivityLinkResponseDto })
  async findOne(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ConnectivityLinkResponseDto> {
    const link = await this.service.findOne(req.user.tenantId, id, ctx);
    return toResponse(ConnectivityLinkResponseDto, link);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update a connectivity link' })
  @ApiOkResponse({ type: ConnectivityLinkResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateConnectivityLinkDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ConnectivityLinkResponseDto> {
    const link = await this.service.update(req.user.tenantId, id, dto, ctx);
    return toResponse(ConnectivityLinkResponseDto, link);
  }

  @Delete(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete a connectivity link' })
  @ApiOkResponse({ type: DeletedResponseDto })
  async remove(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<DeletedResponseDto> {
    return this.service.remove(req.user.tenantId, id, ctx);
  }

  @Post(':id/generate-expense')
  @RequireWrite()
  @ApiOperation({ summary: 'Generate a recurring MONTHLY expense from this connectivity link' })
  @ApiCreatedResponse({ type: ConnectivityLinkResponseDto })
  async generateExpense(
    @Param('id') id: string,
    @Body() body: { bearerId: string; label?: string },
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ConnectivityLinkResponseDto> {
    const link = await this.service.generateExpense(req.user.tenantId, id, body, req.user.id, ctx);
    return toResponse(ConnectivityLinkResponseDto, link);
  }

  /**
   * Resync the linked Expense's totalAmount from the current monthlyPrice
   * (frozen-by-default policy, ADR-011 §2). Returns { expense, before, after }.
   */
  @Patch(':id/resync-expense')
  @RequireWrite()
  @ApiOperation({ summary: 'Resync linked expense from connectivity monthly price (ADR-011)' })
  @ApiOkResponse({ type: ConnectivityResyncExpenseResponseDto })
  async resyncExpense(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ConnectivityResyncExpenseResponseDto> {
    const link = await this.service.findOne(req.user.tenantId, id, ctx);
    if (!link.expenseId) {
      throw new BadRequestException('No expense linked to this connectivity link');
    }
    const result = await this.expensesService.resyncExpense(req.user.tenantId, link.expenseId, {
      kind: 'connectivity',
      sourceId: id,
    });
    return toResponse(ConnectivityResyncExpenseResponseDto, result);
  }
}
