import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProvidersService } from './providers.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { QueryProviderDto } from './dto/query-provider.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('providers')
@Controller('providers')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @Resource('providers') @Action('create')
  @ApiOperation({ summary: 'Create new provider' })
  create(@Body() createProviderDto: CreateProviderDto, @Request() req: AuthRequest) {
    return this.providersService.create(req.user.tenantId, createProviderDto);
  }

  @Get()
  @Resource('providers') @Action('read')
  @ApiOperation({ summary: 'Get all providers' })
  findAll(@Query() query: QueryProviderDto, @Request() req: AuthRequest) {
    return this.providersService.findAll(req.user.tenantId, query);
  }

  @Get(':id')
  @Resource('providers') @Action('read')
  @ApiOperation({ summary: 'Get provider by id' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.providersService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @Resource('providers') @Action('update')
  @ApiOperation({ summary: 'Update provider' })
  update(
    @Param('id') id: string,
    @Body() updateProviderDto: UpdateProviderDto,
    @Request() req: AuthRequest,
  ) {
    return this.providersService.update(req.user.tenantId, id, updateProviderDto);
  }

  @Delete(':id')
  @Resource('providers') @Action('delete')
  @ApiOperation({ summary: 'Delete provider' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.providersService.remove(req.user.tenantId, id);
  }
}
