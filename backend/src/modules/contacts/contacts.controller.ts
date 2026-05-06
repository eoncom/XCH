import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactDto } from './dto/query-contact.dto';
import {
  ContactResponseDto,
  ContactDeletedResultResponseDto,
} from './dto/contact.response.dto';
import { ContactListResponseDto } from './dto/contact-list.response.dto';
import { toResponse } from '../../common/utils/to-response.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';

@RequireModule('contacts')
@ApiTags('contacts')
@Controller('contacts')
@UseGuards(JwtAuthGuard, ModuleGuard)
@ApiBearerAuth()
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create a new contact' })
  @ApiCreatedResponse({ type: ContactResponseDto })
  async create(
    @Body() createContactDto: CreateContactDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ContactResponseDto> {
    const created = await this.contactsService.create(req.user.tenantId, createContactDto, ctx);
    return toResponse(ContactResponseDto, created);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Get all contacts' })
  @ApiOkResponse({ type: ContactListResponseDto, description: 'Paginated contacts (data + meta)' })
  async findAll(
    @Query() query: QueryContactDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ContactListResponseDto> {
    const result = await this.contactsService.findAll(req.user.tenantId, query, ctx);
    return toResponse(ContactListResponseDto, result);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get a contact by ID' })
  @ApiOkResponse({ type: ContactResponseDto })
  async findOne(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ContactResponseDto> {
    const row = await this.contactsService.findOne(req.user.tenantId, id, ctx);
    return toResponse(ContactResponseDto, row);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update a contact' })
  @ApiOkResponse({ type: ContactResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateContactDto: UpdateContactDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ContactResponseDto> {
    const updated = await this.contactsService.update(req.user.tenantId, id, updateContactDto, ctx);
    return toResponse(ContactResponseDto, updated);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete a contact' })
  @ApiOkResponse({ type: ContactDeletedResultResponseDto })
  async remove(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ContactDeletedResultResponseDto> {
    const result = await this.contactsService.remove(req.user.tenantId, id, ctx);
    return toResponse(ContactDeletedResultResponseDto, result);
  }
}
