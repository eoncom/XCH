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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ContactCategory } from '@prisma/client';
import { ContactTypesService } from './contact-types.service';
import { CreateContactTypeDto } from './dto/create-contact-type.dto';
import { UpdateContactTypeDto } from './dto/update-contact-type.dto';
import {
  ContactTypeResponseDto,
  ContactTypeDeletedResultResponseDto,
} from './dto/contact-type.response.dto';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('contact-types')
@ApiBearerAuth()
@Controller('contact-types')
@UseGuards(JwtAuthGuard)
export class ContactTypesController {
  constructor(private readonly contactTypesService: ContactTypesService) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create a new contact type' })
  @ApiCreatedResponse({ type: ContactTypeResponseDto, description: 'Contact type created successfully' })
  async create(
    @Request() req: AuthRequest,
    @Body() createContactTypeDto: CreateContactTypeDto,
  ): Promise<ContactTypeResponseDto> {
    const created = await this.contactTypesService.create(req.user.tenantId, createContactTypeDto);
    return toResponse(ContactTypeResponseDto, created);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Get all contact types' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ContactCategory,
    description: 'Filter by contact category',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiOkResponse({ type: [ContactTypeResponseDto], description: 'List of contact types (system types listed first)' })
  async findAll(
    @Request() req: AuthRequest,
    @Query('category') category?: ContactCategory,
    @Query('isActive') isActive?: string,
  ): Promise<ContactTypeResponseDto[]> {
    const filters: any = {};

    if (category) {
      filters.category = category;
    }

    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    const rows = await this.contactTypesService.findAll(req.user.tenantId, filters);
    return toResponseArray(ContactTypeResponseDto, rows);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get a contact type by ID' })
  @ApiOkResponse({ type: ContactTypeResponseDto })
  async findOne(@Request() req: AuthRequest, @Param('id') id: string): Promise<ContactTypeResponseDto> {
    const row = await this.contactTypesService.findOne(req.user.tenantId, id);
    return toResponse(ContactTypeResponseDto, row);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update a contact type' })
  @ApiOkResponse({ type: ContactTypeResponseDto })
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() updateContactTypeDto: UpdateContactTypeDto,
  ): Promise<ContactTypeResponseDto> {
    const updated = await this.contactTypesService.update(req.user.tenantId, id, updateContactTypeDto);
    return toResponse(ContactTypeResponseDto, updated);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete a contact type' })
  @ApiOkResponse({ type: ContactTypeDeletedResultResponseDto })
  async remove(@Request() req: AuthRequest, @Param('id') id: string): Promise<ContactTypeDeletedResultResponseDto> {
    const result = await this.contactTypesService.remove(req.user.tenantId, id);
    return toResponse(ContactTypeDeletedResultResponseDto, result);
  }
}
