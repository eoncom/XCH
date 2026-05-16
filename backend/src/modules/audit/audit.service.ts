import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface AuditQuery {
  entity?: string;
  entityId?: string;
  userId?: string;
  /** ADR-028 §B.2 — filtre par délégation (super-admin only audit view). */
  delegationId?: string;
  action?: 'CREATE' | 'UPDATE' | 'DELETE';
  from?: string; // ISO
  to?: string; // ISO
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaClient) {}

  async query(tenantId: string, q: AuditQuery) {
    const page = Math.max(q.page || 1, 1);
    const pageSize = Math.min(Math.max(q.pageSize || 50, 1), 200);
    const skip = (page - 1) * pageSize;

    const where: any = { tenantId };
    if (q.entity) where.entityType = q.entity;
    if (q.entityId) where.entityId = q.entityId;
    if (q.userId) where.userId = q.userId;
    if (q.delegationId) where.delegationId = q.delegationId;
    if (q.action) where.action = q.action;
    if (q.from || q.to) {
      where.timestamp = {};
      if (q.from) where.timestamp.gte = new Date(q.from);
      if (q.to) where.timestamp.lte = new Date(q.to);
    }

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          // ADR-028 §B.3 — expose delegation label pour UI super-admin audit view.
          delegation: { select: { id: true, name: true, code: true } },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    // Enrich with human-readable entity labels (name/title/code) so the UI
    // can show "Switch Cisco 9300" instead of just "clxxxxxxxx..."
    const enriched = await this.enrichWithEntityLabels(tenantId, items);

    return {
      data: enriched,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Fetch display labels for the entities referenced by the audit rows.
   * Runs one query per entity type, then attaches `entityLabel` to each row.
   */
  private async enrichWithEntityLabels(tenantId: string, rows: any[]) {
    // Group entityIds by entityType (case-insensitive lookup)
    const byType = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!r.entityId) continue;
      const key = (r.entityType || '').toLowerCase();
      if (!byType.has(key)) byType.set(key, new Set());
      byType.get(key)!.add(r.entityId);
    }

    const labels = new Map<string, string>(); // `${type}:${id}` -> label

    const addLabel = (type: string, id: string, label: string) => {
      labels.set(`${type.toLowerCase()}:${id}`, label);
    };

    // Assets
    const assetIds = byType.get('asset') || byType.get('assets');
    if (assetIds?.size) {
      const assets = await this.prisma.asset.findMany({
        where: { tenantId, id: { in: [...assetIds] } },
        select: { id: true, name: true, manufacturer: true, model: true, serialNumber: true, type: true },
      });
      for (const a of assets) {
        const label = a.name
          || [a.manufacturer, a.model].filter(Boolean).join(' ')
          || `${a.type}${a.serialNumber ? ' · ' + a.serialNumber : ''}`;
        addLabel('asset', a.id, label);
      }
    }

    // Sites
    const siteIds = byType.get('site') || byType.get('sites');
    if (siteIds?.size) {
      const sites = await this.prisma.site.findMany({
        where: { tenantId, id: { in: [...siteIds] } },
        select: { id: true, name: true, code: true },
      });
      for (const s of sites) addLabel('site', s.id, `${s.code} — ${s.name}`);
    }

    // Racks
    const rackIds = byType.get('rack') || byType.get('racks');
    if (rackIds?.size) {
      const racks = await this.prisma.rack.findMany({
        where: { tenantId, id: { in: [...rackIds] } },
        select: { id: true, name: true, site: { select: { code: true } } },
      });
      for (const r of racks) addLabel('rack', r.id, `${r.name}${r.site?.code ? ' · ' + r.site.code : ''}`);
    }

    // Tasks
    const taskIds = byType.get('task') || byType.get('tasks');
    if (taskIds?.size) {
      const tasks = await this.prisma.task.findMany({
        where: { tenantId, id: { in: [...taskIds] } },
        select: { id: true, title: true },
      });
      for (const t of tasks) addLabel('task', t.id, t.title);
    }

    // Contacts
    const contactIds = byType.get('contact') || byType.get('contacts');
    if (contactIds?.size) {
      const contacts = await this.prisma.contact.findMany({
        where: { tenantId, id: { in: [...contactIds] } },
        select: { id: true, name: true },
      });
      for (const c of contacts) addLabel('contact', c.id, c.name);
    }

    // FloorPlans
    const planIds = byType.get('floorplan') || byType.get('floor_plan') || byType.get('floorplans');
    if (planIds?.size) {
      const plans = await this.prisma.floorPlan.findMany({
        where: { site: { tenantId }, id: { in: [...planIds] } },
        select: { id: true, title: true, version: true },
      });
      for (const p of plans) addLabel('floorplan', p.id, `${p.title}${p.version ? ' v' + p.version : ''}`);
    }

    return rows.map((r) => ({
      ...r,
      entityLabel: r.entityId
        ? (labels.get(`${(r.entityType || '').toLowerCase()}:${r.entityId}`) || null)
        : null,
    }));
  }
}
