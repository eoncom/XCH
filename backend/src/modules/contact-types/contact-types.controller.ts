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
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ContactCategory } from '@prisma/client';
import { ContactTypesService } from './contact-types.service';
import { CreateContactTypeDto } from './dto/create-contact-type.dto';
import { UpdateContactTypeDto } from './dto/update-contact-type.dto';
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
  @ApiResponse({
    status: 201,
    description: 'Contact type created successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Contact type with this name already exists',
  })
  create(
    @Request() req: AuthRequest,
    @Body() createContactTypeDto: CreateContactTypeDto,
  ) {
    return this.contactTypesService.create(
      req.user.tenantId,
      createContactTypeDto,
    );
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
  @ApiResponse({
    status: 200,
    description: 'List of contact types (system types listed first)',
  })
  findAll(
    @Request() req: AuthRequest,
    @Query('category') category?: ContactCategory,
    @Query('isActive') isActive?: string,
  ) {
    const filters: any = {};

    if (category) {
      filters.category = category;
    }

    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    return this.contactTypesService.findAll(req.user.tenantId, filters);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get a contact type by ID' })
  @ApiResponse({ status: 200, description: 'Contact type found' })
  @ApiResponse({ status: 404, description: 'Contact type not found' })
  findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.contactTypesService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update a contact type' })
  @ApiResponse({ status: 200, description: 'Contact type updated' })
  @ApiResponse({
    status: 403,
    description: 'Cannot modify name/category of system types',
  })
  @ApiResponse({ status: 404, description: 'Contact type not found' })
  @ApiResponse({
    status: 409,
    description: 'Contact type with this name already exists',
  })
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() updateContactTypeDto: UpdateContactTypeDto,
  ) {
    return this.contactTypesService.update(
      req.user.tenantId,
      id,
      updateContactTypeDto,
    );
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete a contact type' })
  @ApiResponse({ status: 200, description: 'Contact type deleted' })
  @ApiResponse({ status: 403, description: 'Cannot delete system types' })
  @ApiResponse({ status: 404, description: 'Contact type not found' })
  @ApiResponse({
    status: 409,
    description: 'Contact type is in use and cannot be deleted',
  })
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.contactTypesService.remove(req.user.tenantId, id);
  }
}
