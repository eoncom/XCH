import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient, ContactCategory } from '@prisma/client';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactDto } from './dto/query-contact.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';
import { validateScope } from '../../common/utils/scope-validation.util';
import { resolveHierarchicalScopes } from '../../common/utils/scope-resolution.util';

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

    // Validate scope if provided
    if (createContactDto.scopeType && createContactDto.scopeId) {
      await validateScope(this.prisma as any, tenantId, createContactDto.scopeType, createContactDto.scopeId);
    }

    return this.prisma.contact.create({
      data: {
        ...createContactDto,
        scopeType: createContactDto.scopeType || null,
        scopeId: createContactDto.scopeId || null,
        tenantId,
      } as any,
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

    // Direct scope filter (exact match)
    if (query.scopeType) {
      where.scopeType = query.scopeType;
      if (query.scopeId) where.scopeId = query.scopeId;
    }

    // Hierarchical scope filter: show contacts visible at this scope (global + ancestors + exact)
    if (query.forScopeType && query.forScopeId) {
      const scopeConditions = await resolveHierarchicalScopes(
        this.prisma as any,
        query.forScopeType,
        query.forScopeId,
      );
      if (where.OR) {
        // Merge search OR with scope OR using AND
        where.AND = [{ OR: where.OR }, { OR: scopeConditions }];
        delete where.OR;
      } else {
        where.OR = scopeConditions;
      }
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
    const existingContact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });

    if (!existingContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    // Validate typeId if provided
    if (updateContactDto.typeId) {
      const contactType = await this.prisma.contactType.findFirst({
        where: { id: updateContactDto.typeId, tenantId },
      });
      if (!contactType) {
        throw new NotFoundException(
          `Contact type with ID ${updateContactDto.typeId} not found for this tenant`,
        );
      }
    }

    // Validate scope if changing
    if (updateContactDto.scopeType && updateContactDto.scopeId) {
      await validateScope(this.prisma as any, tenantId, updateContactDto.scopeType, updateContactDto.scopeId);
    }

    const data: any = { ...updateContactDto };
    // Handle explicit null to clear scope
    if (updateContactDto.scopeType === null || updateContactDto.scopeType === undefined) {
      // Only clear if explicitly passed
      if ('scopeType' in updateContactDto && updateContactDto.scopeType === null) {
        data.scopeType = null;
        data.scopeId = null;
      }
    }

    return this.prisma.contact.update({
      where: { id },
      data,
      include: {
        type: true,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const existingContact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });

    if (!existingContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    // Check if contact is used as vendor in expenses
    const vendorExpenseCount = await this.prisma.expense.count({
      where: { vendorId: id } as any,
    });

    if (vendorExpenseCount > 0) {
      throw new ConflictException(
        `Ce contact est référencé comme fournisseur dans ${vendorExpenseCount} dépense(s). Dissociez-le d'abord.`,
      );
    }

    await this.prisma.contact.delete({
      where: { id },
    });

    return { message: 'Contact deleted successfully' };
  }

  async setActive(tenantId: string, id: string, isActive: boolean) {
    const existingContact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
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
