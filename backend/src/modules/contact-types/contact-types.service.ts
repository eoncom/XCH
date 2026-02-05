import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient, ContactCategory } from '@prisma/client';
import { CreateContactTypeDto } from './dto/create-contact-type.dto';
import { UpdateContactTypeDto } from './dto/update-contact-type.dto';

@Injectable()
export class ContactTypesService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Slugify text: normalize, lowercase, replace spaces with hyphens
   */
  private slugify(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Create a new contact type
   * Auto-generates slug from name and verifies uniqueness
   */
  async create(tenantId: string, createContactTypeDto: CreateContactTypeDto) {
    const { name, category, color, icon } = createContactTypeDto;

    // Generate slug from name
    const slug = this.slugify(name);

    // Check if slug already exists for this tenant
    const existing = await this.prisma.contactType.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A contact type with the name "${name}" already exists`,
      );
    }

    // Create contact type (isSystem defaults to false for user-created types)
    return this.prisma.contactType.create({
      data: {
        tenantId,
        name,
        slug,
        category,
        color,
        icon,
        isSystem: false,
        isActive: true,
      },
    });
  }

  /**
   * Find all contact types with optional filters
   * System types are listed first, then sorted by name
   */
  async findAll(
    tenantId: string,
    filters?: {
      category?: ContactCategory;
      isActive?: boolean;
    },
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.contactType.findMany({
      where,
      orderBy: [
        { isSystem: 'desc' }, // System types first
        { name: 'asc' },      // Then alphabetically
      ],
    });
  }

  /**
   * Find one contact type by ID
   */
  async findOne(tenantId: string, id: string) {
    const contactType = await this.prisma.contactType.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!contactType) {
      throw new NotFoundException(`Contact type with ID ${id} not found`);
    }

    return contactType;
  }

  /**
   * Update contact type
   * System types can only update color and icon (not name, slug, category)
   */
  async update(
    tenantId: string,
    id: string,
    updateContactTypeDto: UpdateContactTypeDto,
  ) {
    const contactType = await this.findOne(tenantId, id);

    // Check if trying to modify protected fields on system types
    if (contactType.isSystem) {
      const { name, category } = updateContactTypeDto;
      if (name !== undefined || category !== undefined) {
        throw new ForbiddenException(
          'System contact types cannot have their name or category modified. Only color and icon can be updated.',
        );
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateContactTypeDto.color !== undefined) {
      updateData.color = updateContactTypeDto.color;
    }

    if (updateContactTypeDto.icon !== undefined) {
      updateData.icon = updateContactTypeDto.icon;
    }

    // Only update name and category for non-system types
    if (!contactType.isSystem) {
      if (updateContactTypeDto.name !== undefined) {
        updateData.name = updateContactTypeDto.name;
        updateData.slug = this.slugify(updateContactTypeDto.name);

        // Check slug uniqueness if name changed
        if (updateData.name !== contactType.name) {
          const existing = await this.prisma.contactType.findFirst({
            where: {
              tenantId,
              slug: updateData.slug,
              id: { not: id },
            },
          });

          if (existing) {
            throw new ConflictException(
              `A contact type with the name "${updateContactTypeDto.name}" already exists`,
            );
          }
        }
      }

      if (updateContactTypeDto.category !== undefined) {
        updateData.category = updateContactTypeDto.category;
      }
    }

    return this.prisma.contactType.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Remove contact type
   * Cannot remove system types or types with existing contacts
   */
  async remove(tenantId: string, id: string) {
    const contactType = await this.findOne(tenantId, id);

    // Cannot remove system types
    if (contactType.isSystem) {
      throw new ForbiddenException('System contact types cannot be deleted');
    }

    // Check if contacts exist with this type
    const contactCount = await this.prisma.contact.count({
      where: {
        typeId: id,
      },
    });

    if (contactCount > 0) {
      throw new ConflictException(
        `Cannot delete contact type: ${contactCount} contact(s) are using this type`,
      );
    }

    // Delete the contact type
    await this.prisma.contactType.delete({
      where: { id },
    });

    return { message: 'Contact type deleted successfully' };
  }
}
