import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface SearchHit {
  type: 'asset' | 'site' | 'rack' | 'task' | 'contact';
  id: string;
  title: string;
  subtitle?: string;
  link: string;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaClient) {}

  async search(tenantId: string, q: string, limit = 10): Promise<{ hits: SearchHit[]; byType: Record<string, number> }> {
    const query = q.trim();
    if (!query || query.length < 2) {
      return { hits: [], byType: {} };
    }

    const contains = { contains: query, mode: 'insensitive' as const };

    const [assets, sites, racks, tasks, contacts] = await Promise.all([
      this.prisma.asset.findMany({
        where: {
          tenantId,
          OR: [
            { serialNumber: contains },
            { name: contains },
            { model: contains },
            { manufacturer: contains },
            { inventoryTag: contains },
          ],
        },
        take: limit,
        select: { id: true, name: true, serialNumber: true, type: true },
      }),
      this.prisma.site.findMany({
        where: {
          tenantId,
          OR: [
            { name: contains },
            { code: contains },
            { city: contains },
            { address: contains },
          ],
        },
        take: limit,
        select: { id: true, name: true, code: true, city: true },
      }),
      this.prisma.rack.findMany({
        where: {
          tenantId,
          OR: [
            { name: contains },
            { location: contains },
          ],
        },
        take: limit,
        select: { id: true, name: true, location: true },
      }),
      this.prisma.task.findMany({
        where: {
          tenantId,
          OR: [
            { title: contains },
            { description: contains },
            { ticketRef: contains },
          ],
        },
        take: limit,
        select: { id: true, title: true, status: true },
      }),
      this.prisma.contact.findMany({
        where: {
          tenantId,
          OR: [
            { name: contains },
            { email: contains },
            { company: contains },
          ],
        },
        take: limit,
        select: { id: true, name: true, email: true, company: true },
      }),
    ]);

    const hits: SearchHit[] = [
      ...assets.map((a) => ({
        type: 'asset' as const,
        id: a.id,
        title: a.name || a.serialNumber || a.id,
        subtitle: [a.type, a.serialNumber].filter(Boolean).join(' • '),
        link: `/dashboard/assets/${a.id}`,
      })),
      ...sites.map((s) => ({
        type: 'site' as const,
        id: s.id,
        title: s.name,
        subtitle: [s.code, s.city].filter(Boolean).join(' • '),
        link: `/dashboard/sites/${s.id}`,
      })),
      ...racks.map((r) => ({
        type: 'rack' as const,
        id: r.id,
        title: r.name,
        subtitle: r.location || undefined,
        link: `/dashboard/racks/${r.id}`,
      })),
      ...tasks.map((t) => ({
        type: 'task' as const,
        id: t.id,
        title: t.title,
        subtitle: t.status,
        link: `/dashboard/tasks/${t.id}`,
      })),
      ...contacts.map((c) => ({
        type: 'contact' as const,
        id: c.id,
        title: c.name,
        subtitle: [c.company, c.email].filter(Boolean).join(' • '),
        link: `/dashboard/contacts/${c.id}`,
      })),
    ];

    return {
      hits,
      byType: {
        asset: assets.length,
        site: sites.length,
        rack: racks.length,
        task: tasks.length,
        contact: contacts.length,
      },
    };
  }
}
