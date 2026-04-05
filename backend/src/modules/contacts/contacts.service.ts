import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, ContactCategory } from '@prisma/client';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactDto } from './dto/query-contact.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(tenantId: string, createContactDto: CreateContactDto) {
    // Validate that the contact type exists and belongs to the tenant
    const contactType = await this.prisma.contactType.findFirst({
      where: {
        id: createContactDto.typeId,
        tenantId,
      },
    });

    if (!contactType) {
      throw new NotFoundException(
        `Contact type with ID ${createContactDto.typeId} not found for this tenant`,
      );
    }

    return this.prisma.contact.create({
      data: {
        ...createContactDto,
        tenantId,
      },
      include: {
        type: true,
      },
    });
  }

  async findAll(tenantId: string, query: QueryContactDto): Promise<PaginatedResponse<any>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const { typeId, category, search, isActive } = query;

    // Build where clause
    const where: any = {
      tenantId,
    };

    // Filter by type ID
    if (typeId) {
      where.typeId = typeId;
    }

    // Filter by category (via type relation)
    if (category) {
      where.type = {
        category: category as ContactCategory,
      };
    }

    // Filter by active status
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Search by name, email, or company (case-insensitive)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Determine sort order (default: name asc)
    const allowedSortFields = ['name', 'createdAt', 'updatedAt', 'isActive'];
    const hasExplicitSort = query.sortBy && allowedSortFields.includes(query.sortBy);
    const sortBy: string = hasExplicitSort ? query.sortBy! : 'name';
    const sortOrder = hasExplicitSort ? (query.sortOrder ?? 'desc') : 'asc';

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        include: {
          type: true,
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: pageSize,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return buildPaginatedResponse(contacts, total, page, pageSize);
  }

  async findOne(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        type: true,
        externalRefs: true,
      },
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    return contact;
  }

  async update(tenantId: string, id: string, updateContactDto: UpdateContactDto) {
    // Check if contact exists and belongs to tenant
    const existingContact = await this.prisma.contact.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    // Validate typeId if provided
    if (updateContactDto.typeId) {
      const contactType = await this.prisma.contactType.findFirst({
        where: {
          id: updateContactDto.typeId,
          tenantId,
        },
      });

      if (!contactType) {
        throw new NotFoundException(
          `Contact type with ID ${updateContactDto.typeId} not found for this tenant`,
        );
      }
    }

    return this.prisma.contact.update({
      where: { id },
      data: updateContactDto,
      include: {
        type: true,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    // Check if contact exists and belongs to tenant
    const existingContact = await this.prisma.contact.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    // Hard delete the contact
    await this.prisma.contact.delete({
      where: { id },
    });

    return { message: 'Contact deleted successfully' };
  }

  async setActive(tenantId: string, id: string, isActive: boolean) {
    // Check if contact exists and belongs to tenant
    const existingContact = await this.prisma.contact.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    return this.prisma.contact.update({
      where: { id },
      data: { isActive },
      include: {
        type: true,
      },
    });
  }
}
