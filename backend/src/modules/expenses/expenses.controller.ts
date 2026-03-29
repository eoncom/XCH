import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';
import { Response } from 'express';

@ApiTags('expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Resource('expenses') @Action('create')
  @ApiOperation({ summary: 'Create an expense with optional allocations' })
  create(@Body() dto: CreateExpenseDto, @Request() req: AuthRequest) {
    return this.expensesService.create(req.user.tenantId, dto, req.user.userId);
  }

  @Get()
  @Resource('expenses') @Action('read')
  @ApiOperation({ summary: 'List all expenses' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'bearerId', required: false })
  @ApiQuery({ name: 'targetId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('type') type: string,
    @Query('bearerId') bearerId: string,
    @Query('targetId') targetId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('search') search: string,
    @Request() req: AuthRequest,
  ) {
    return this.expensesService.findAll(req.user.tenantId, { type, bearerId, targetId, dateFrom, dateTo, search });
  }

  @Get('reports/by-bearer')
  @Resource('expenses') @Action('read')
  @ApiOperation({ summary: 'Report: total by bearer' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  reportByBearer(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: AuthRequest,
  ) {
    return this.expensesService.reportByBearer(req.user.tenantId, { dateFrom, dateTo });
  }

  @Get('reports/by-target')
  @Resource('expenses') @Action('read')
  @ApiOperation({ summary: 'Report: total by target' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  reportByTarget(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: AuthRequest,
  ) {
    return this.expensesService.reportByTarget(req.user.tenantId, { dateFrom, dateTo });
  }

  @Get('reports/chargeback')
  @Resource('expenses') @Action('read')
  @ApiOperation({ summary: 'Report: chargeback detail' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  reportChargeback(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: AuthRequest,
  ) {
    return this.expensesService.reportChargeback(req.user.tenantId, { dateFrom, dateTo });
  }

  @Get('export')
  @Resource('expenses') @Action('read')
  @ApiOperation({ summary: 'Export expenses to Excel' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async exportExcel(
    @Query('type') type: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: AuthRequest,
    @Res() res: Response,
  ) {
    const expenses = await this.expensesService.findAll(req.user.tenantId, { type, dateFrom, dateTo });

    // Build CSV export (simple, no external dependency needed)
    const headers = ['Label', 'Type', 'Montant', 'Devise', 'Fréquence', 'Date', 'Porteur', 'Vendor', 'Facture', 'PO', 'Cibles (%)'];
    const rows = expenses.map((e: any) => {
      const targets = (e.allocations || [])
        .map((a: any) => `${a.target?.name || a.targetId} (${a.percentage}%)`)
        .join('; ');
      return [
        e.label,
        e.type,
        e.totalAmount,
        e.currency,
        e.frequency,
        new Date(e.dateIncurred).toISOString().split('T')[0],
        e.bearer?.name || e.bearerId,
        e.vendor || '',
        e.invoiceRef || '',
        e.poNumber || '',
        targets,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=expenses-export.csv');
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  }

  @Get(':id')
  @Resource('expenses') @Action('read')
  @ApiOperation({ summary: 'Get an expense with allocations' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.expensesService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @Resource('expenses') @Action('update')
  @ApiOperation({ summary: 'Update an expense' })
  update(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @Request() req: AuthRequest) {
    return this.expensesService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Resource('expenses') @Action('delete')
  @ApiOperation({ summary: 'Delete an expense' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.expensesService.remove(req.user.tenantId, id);
  }
}
