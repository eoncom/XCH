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
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactDto } from './dto/query-contact.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('contacts')
@Controller('contacts')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @Resource('contacts')
  @Action('create')
  @ApiOperation({ summary: 'Create a new contact' })
  @ApiResponse({
    status: 201,
    description: 'The contact has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 404, description: 'Contact type not found.' })
  create(
    @Body() createContactDto: CreateContactDto,
    @Request() req: AuthRequest,
  ) {
    return this.contactsService.create(req.user.tenantId, createContactDto);
  }

  @Get()
  @Resource('contacts')
  @Action('read')
  @ApiOperation({ summary: 'Get all contacts' })
  @ApiResponse({
    status: 200,
    description: 'Return all contacts matching the query parameters.',
  })
  findAll(@Query() query: QueryContactDto, @Request() req: AuthRequest) {
    return this.contactsService.findAll(req.user.tenantId, query);
  }

  @Get(':id')
  @Resource('contacts')
  @Action('read')
  @ApiOperation({ summary: 'Get a contact by ID' })
  @ApiResponse({ status: 200, description: 'Return the contact.' })
  @ApiResponse({ status: 404, description: 'Contact not found.' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.contactsService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @Resource('contacts')
  @Action('update')
  @ApiOperation({ summary: 'Update a contact' })
  @ApiResponse({
    status: 200,
    description: 'The contact has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Contact not found.' })
  update(
    @Param('id') id: string,
    @Body() updateContactDto: UpdateContactDto,
    @Request() req: AuthRequest,
  ) {
    return this.contactsService.update(
      req.user.tenantId,
      id,
      updateContactDto,
    );
  }

  @Delete(':id')
  @Resource('contacts')
  @Action('delete')
  @ApiOperation({ summary: 'Delete a contact' })
  @ApiResponse({
    status: 200,
    description: 'The contact has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Contact not found.' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.contactsService.remove(req.user.tenantId, id);
  }
}
