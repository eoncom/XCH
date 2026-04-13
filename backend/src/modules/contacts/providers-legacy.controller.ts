import {
  Controller,
  Get,
  Query,
  Param,
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
import { QueryContactDto } from './dto/query-contact.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireRead } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('providers')
@Controller('providers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProvidersLegacyController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @RequireRead()
  @ApiOperation({
    summary: 'Get all contacts (legacy providers endpoint)',
    description: 'This endpoint is deprecated. Use /contacts instead. Maintained for backward compatibility.',
  })
  @ApiResponse({
    status: 200,
    description: 'Return all contacts matching the query parameters.',
  })
  findAll(@Query() query: QueryContactDto, @Request() req: AuthRequest) {
    return this.contactsService.findAll(req.user.tenantId, query);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({
    summary: 'Get a contact by ID (legacy providers endpoint)',
    description: 'This endpoint is deprecated. Use /contacts/:id instead. Maintained for backward compatibility.',
  })
  @ApiResponse({ status: 200, description: 'Return the contact.' })
  @ApiResponse({ status: 404, description: 'Contact not found.' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.contactsService.findOne(req.user.tenantId, id);
  }
}
