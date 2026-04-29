import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient, ContactCategory } from '@prisma/client';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactDto } from './dto/query-contact.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';
import { validateDelegationSiteCoherence } from '../../common/utils/delegation-site-validation.util';
import { PermissionService } from '../../common/services/permission.service';
import { CallerCtx } from '../../common/types/caller-ctx.interface';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly perm: PermissionService,
  ) {}

  async create(tenantId: string, createContactDto: CreateContactDto, callerCtx: CallerCtx) {
    // ADR-021 — refuse creation in a delegation the caller can't write to.
    // delegationId=null = global contact, super-admin only.
    await this.perm.assertCanWriteDelegation(
      callerCtx,
      createContactDto.delegationId ?? null,
    );

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

  async findAll(
    tenantId: string,
    query: QueryContactDto,
    callerCtx: CallerCtx,
  ): Promise<PaginatedResponse<any>> {
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

    // ADR-021 — automatic delegation scope (no longer opt-in via query).
    // Contact.delegationId=NULL is "global, readable by everyone in the tenant"
    // per schema annotation line 1009. Non-super-admin users see only :
    //   - contacts attached to a delegation they belong to (any right).
    //   - global contacts (delegationId IS NULL).
    // The legacy `query.delegationId` and `query.includeGlobal` filters
    // narrow the result further (UI scoping) but cannot widen it.
    const readableDelegations = await this.perm.getReadableDelegationIds(callerCtx);
    if (readableDelegations !== null) {
      const scopeCondition = [
        { delegationId: { in: readableDelegations } },
        { delegationId: null },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: scopeCondition }];
        delete where.OR;
      } else {
        where.OR = scopeCondition;
      }
    }

    // UI narrowing : the user can ask to see only one delegation among
    // those they have access to. With/without globals via includeGlobal.
    if (query.delegationId) {
      const rawInclude = (query.includeGlobal as any);
      const optedOutOfGlobal =
        rawInclude === false || rawInclude === 'false' || rawInclude === '0';
      const narrow = optedOutOfGlobal
        ? [{ delegationId: query.delegationId }]
        : [{ delegationId: query.delegationId }, { delegationId: null }];
      // Compose with existing AND/OR.
      if (where.AND) {
        where.AND.push({ OR: narrow });
      } else if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: narrow }];
        delete where.OR;
      } else {
        where.OR = narrow;
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

  async findOne(tenantId: string, id: string, callerCtx: CallerCtx) {
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

    // ADR-021 — re-check read access (defense against guess-by-id).
    // Contact.delegationId=NULL is the "global / shared" case — allowGlobal=true.
    await this.perm.assertCanReadDelegation(callerCtx, contact.delegationId, {
      allowGlobal: true,
    });

    return contact;
  }

  async update(
    tenantId: string,
    id: string,
    updateContactDto: UpdateContactDto,
    callerCtx: CallerCtx,
  ) {
    const existingContact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });

    if (!existingContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    // ADR-021 — write access on the CURRENT scope (before any move).
    // A global contact (delegationId=null) can only be edited by super admin.
    await this.perm.assertCanWriteDelegation(callerCtx, existingContact.delegationId);

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

    // ADR-021 — if the user moves the contact to a different delegation,
    // they must also have write access to the destination scope.
    if ('delegationId' in updateContactDto && delegationId !== existingContact.delegationId) {
      await this.perm.assertCanWriteDelegation(callerCtx, delegationId ?? null);
    }

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

  async remove(tenantId: string, id: string, callerCtx: CallerCtx) {
    const existingContact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });

    if (!existingContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    // ADR-021 — write access required.
    await this.perm.assertCanWriteDelegation(callerCtx, existingContact.delegationId);

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

  async setActive(tenantId: string, id: string, isActive: boolean, callerCtx: CallerCtx) {
    const existingContact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });

    if (!existingContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    // ADR-021 — write access required.
    await this.perm.assertCanWriteDelegation(callerCtx, existingContact.delegationId);

    return this.prisma.contact.update({
      where: { id },
      data: { isActive },
      include: { type: true },
    });
  }
}
