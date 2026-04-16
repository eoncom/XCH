import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto, UpdateBudgetDto, FilterBudgetDto } from './dto/create-budget.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead, RequireManage } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('budgets')
@Controller('budgets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create a budget' })
  create(@Body() dto: CreateBudgetDto, @Request() req: AuthRequest) {
    return this.service.create(req.user.tenantId, dto);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'List budgets' })
  findAll(@Query() filters: FilterBudgetDto, @Request() req: AuthRequest) {
    return this.service.findAll(req.user.tenantId, filters);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get a budget' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Get(':id/status')
  @RequireRead()
  @ApiOperation({ summary: 'Get budget status (spent vs budgeted)' })
  getStatus(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.service.getStatus(req.user.tenantId, id);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update a budget' })
  update(@Param('id') id: string, @Body() dto: UpdateBudgetDto, @Request() req: AuthRequest) {
    return this.service.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete a budget' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.service.remove(req.user.tenantId, id);
  }
}
