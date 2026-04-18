import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient, ContactCategory } from '@prisma/client';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactDto } from './dto/query-contact.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';
import { validateDelegationSiteCoherence } from '../../common/utils/delegation-site-validation.util';

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

    // Validate delegation/site coherence (R1, R3)
    await validateDelegationSiteCoherence(
      this.prisma as any,
      createContactDto.delegationId,
      createContactDto.siteId,
    );

    return this.prisma.contact.create({
      data: {
        ...createContactDto,
        delegationId: createContactDto.delegationId || null,
        siteId: createContactDto.siteId || null,
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

    const where: any = { tenantId };

    if (typeId) where.typeId = typeId;

    if (category) {
      where.type = { category: category as ContactCategory };
    }

    if (isActive !== undefined) where.isActive = isActive;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Delegation-based filtering.
    //
    // v1.4.x defensive parsing: class-transformer with enableImplicitConversion
    // can mangle boolean strings — `Boolean("false")` returns `true`, so a
    // single `query.includeGlobal !== false` check can be fooled. We re-coerce
    // here to make the semantics explicit: the only way to OPT OUT of global
    // contacts is to pass the literal string "false" or `false`.
    const optedOutOfGlobal =
      query.includeGlobal === false ||
      (query.includeGlobal as any) === 'false' ||
      (query.includeGlobal as any) === '0';
    if (query.delegationId) {
      if (!optedOutOfGlobal) {
        // Show delegation's contacts + global contacts
        const delegationCondition = [
          { delegationId: query.delegationId },
          { delegationId: null },
        ];
        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: delegationCondition }];
          delete where.OR;
        } else {
          where.OR = delegationCondition;
        }
      } else {
        where.delegationId = query.delegationId;
      }
    }

    // Site filter
    if (query.siteId) where.siteId = query.siteId;

    // Determine sort order
    const allowedSortFields = ['name', 'createdAt', 'updatedAt', 'isActive'];
    const hasExplicitSort = query.sortBy && allowedSortFields.includes(query.sortBy);
    const sortBy: string = hasExplicitSort ? query.sortBy! : 'name';
    const sortOrder = hasExplicitSort ? (query.sortOrder ?? 'desc') : 'asc';

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        include: { type: true },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return buildPaginatedResponse(contacts, total, page, pageSize);
  }

  async findOne(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
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

    // Validate delegation/site coherence if changing (R1)
    const delegationId = 'delegationId' in updateContactDto
      ? updateContactDto.delegationId
      : (existingContact as any).delegationId;
    const siteId = 'siteId' in updateContactDto
      ? updateContactDto.siteId
      : (existingContact as any).siteId;

    await validateDelegationSiteCoherence(this.prisma as any, delegationId, siteId);

    const data: any = { ...updateContactDto };
    // Handle explicit null to make global
    if ('delegationId' in updateContactDto && updateContactDto.delegationId === null) {
      data.delegationId = null;
      data.siteId = null;
    }

    return this.prisma.contact.update({
      where: { id },
      data,
      include: { type: true },
    });
  }

  async remove(tenantId: string, id: string) {
    const existingContact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });

    if (!existingContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    const vendorExpenseCount = await this.prisma.expense.count({
      where: { vendorId: id } as any,
    });

    if (vendorExpenseCount > 0) {
      throw new ConflictException(
        `Ce contact est référencé comme fournisseur dans ${vendorExpenseCount} dépense(s). Dissociez-le d'abord.`,
      );
    }

    await this.prisma.contact.delete({ where: { id } });
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
      include: { type: true },
    });
  }
}
