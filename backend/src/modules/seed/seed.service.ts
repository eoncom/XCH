import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, DelegationRight, SiteStatus, HealthStatus, RackType, RackStatus, TaskStatus, TaskPriority, ContactCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async loadDemo(tenantId: string) {
    this.logger.log(`Loading demo data for tenant ${tenantId}`);

    // NOTE: Do NOT overwrite tenant name, but DO initialise tenant.config.appearance
    // so the AppearanceProvider has sane defaults out of the box.
    await this.ensureTenantAppearanceDefaults(tenantId);

    const delegations = await this.createOrganization(tenantId);
    const sites = await this.createSites(tenantId, delegations);
    const users = await this.createUsers(tenantId);
    await this.createUserDelegations(tenantId, users, delegations);
    const racks = await this.createRacks(tenantId, sites);
    const assets = await this.createAssets(tenantId, sites, racks);
    const tasks = await this.createTasks(tenantId, sites, users, assets);
    const contactTypes = await this.createContactTypes(tenantId);
    const contacts = await this.createContacts(tenantId, contactTypes);

    // v1.4 post-audit enrichments (ADR-010 + phase 4 demo coverage)
    await this.createAccessOverrides(tenantId, users, sites);
    await this.createDemoBudgetsAndExpenses(tenantId, delegations, sites, users);
    const links = await this.createConnectivityLinksForDemo(tenantId, sites, assets);
    await this.createSdwanConfigsForDemo(tenantId, sites, assets);
    await this.createDemoUserNotifications(tenantId, users, tasks, sites);
    await this.seedDemoAuditLogEntries(tenantId, users, sites, assets);
    await this.applyTechnicianCustomAppearance(tenantId);

    // ADR-014 — pilot tenant runs on-prem (LAN), allow RFC1918 monitors.
    // Loopback & link-local stay blocked even with this flag (target-validator).
    await this.enableInternalMonitorTargets(tenantId);
    await this.createMonitorChecksForDemo(tenantId, sites, links);

    this.logger.log(`Demo data loaded successfully`);

    return {
      message: 'Données démo chargées avec succès',
      stats: {
        sites: sites.length,
        users: users.length,
        assets: assets.length,
        racks: racks.length,
        tasks: tasks.length,
        contactTypes: contactTypes.length,
        contacts: contacts.length,
      },
    };
  }

  async resetData(tenantId: string, adminUserId: string) {
    this.logger.warn(`Resetting all data for tenant ${tenantId} (preserving admin ${adminUserId})`);

    try {
      // Delete in correct order due to foreign key constraints
      await this.prisma.assetMovement.deleteMany({ where: { tenantId } });
      await this.prisma.taskComment.deleteMany({ where: { task: { tenantId } } });
      await this.prisma.pin.deleteMany({ where: { floorPlan: { site: { tenantId } } } });
      await this.prisma.floorPlan.deleteMany({ where: { site: { tenantId } } });
      await this.prisma.attachment.deleteMany({ where: { tenantId } });
      // ExternalRef has no tenantId — delete via entity IDs from tenant's data
      const tenantSites = await this.prisma.site.findMany({ where: { tenantId }, select: { id: true } });
      const tenantAssets = await this.prisma.asset.findMany({ where: { tenantId }, select: { id: true } });
      const tenantContacts = await this.prisma.contact.findMany({ where: { tenantId }, select: { id: true } });
      const allEntityIds = [
        ...tenantSites.map(s => s.id),
        ...tenantAssets.map(a => a.id),
        ...tenantContacts.map(c => c.id),
      ];
      if (allEntityIds.length > 0) {
        await this.prisma.externalRef.deleteMany({ where: { entityId: { in: allEntityIds } } });
      }
      await this.prisma.task.deleteMany({ where: { tenantId } });
      await this.prisma.asset.deleteMany({ where: { tenantId } });
      await this.prisma.rack.deleteMany({ where: { tenantId } });
      // v1.3+/v1.4 tables — wipe before deleting parents
      await this.prisma.userNotification.deleteMany({ where: { tenantId } });
      // ADR-014 native monitoring — results cascade from checks but wipe
      // explicitly for self-documenting reset order.
      await this.prisma.monitorResult.deleteMany({ where: { check: { tenantId } } });
      await this.prisma.monitorHttpConfig.deleteMany({ where: { check: { tenantId } } });
      await this.prisma.monitorCheck.deleteMany({ where: { tenantId } });
      await this.prisma.connectivityLink.deleteMany({ where: { tenantId } });
      // SD-WAN (phase 6.6) — firewalls cascade from assets/configs but wipe
      // explicitly for self-documenting reset order.
      await this.prisma.sdwanFirewall.deleteMany({ where: { sdwanConfig: { tenantId } } });
      await this.prisma.sdwanConfig.deleteMany({ where: { tenantId } });
      // Cost allocation tables
      await this.prisma.costAllocation.deleteMany({ where: { expense: { tenantId } } });
      await this.prisma.expense.deleteMany({ where: { tenantId } });
      await this.prisma.budget.deleteMany({ where: { tenantId } });
      await this.prisma.billingEntity.deleteMany({ where: { tenantId } });
      // Access model tables
      await this.prisma.accessOverride.deleteMany({ where: { tenantId } });
      await this.prisma.userDelegation.deleteMany({ where: { tenantId } });
      // Sites (must delete before delegations)
      await this.prisma.site.deleteMany({ where: { tenantId } });
      // Organization
      await this.prisma.delegation.deleteMany({ where: { tenantId } });
      await this.prisma.contact.deleteMany({ where: { tenantId } });
      await this.prisma.contactType.deleteMany({ where: { tenantId } });
      await this.prisma.integrationMapping.deleteMany({ where: { tenantId } });
      // userSiteAccess removed in delegation-first refactoring
      await this.prisma.auditLog.deleteMany({ where: { tenantId } });

      // Delete non-admin users
      await this.prisma.user.deleteMany({
        where: {
          tenantId,
          id: { not: adminUserId },
        },
      });

      this.logger.log(`All data deleted for tenant ${tenantId}`);
      return { message: 'Toutes les données ont été supprimées' };
    } catch (error) {
      this.logger.error(`Failed to reset data: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // ORGANIZATION - Divisions & Delegations
  // ============================================================================

  private async createOrganization(tenantId: string) {
    const idfOuest = await this.prisma.delegation.upsert({
      where: { tenantId_code: { tenantId, code: 'IDF-OUEST' } },
      update: { name: 'IDF Ouest' }, // keep idempotent + purge '(éditée)' residues
      create: {
        tenantId,
        name: 'IDF Ouest',
        code: 'IDF-OUEST',
        groupLabel: 'Île-de-France',
        groupColor: '#0070f3',
      },
    });

    const lyon = await this.prisma.delegation.upsert({
      where: { tenantId_code: { tenantId, code: 'LYON-METROPOLE' } },
      update: { name: 'Lyon Métropole' },
      create: {
        tenantId,
        name: 'Lyon Métropole',
        code: 'LYON-METROPOLE',
        groupLabel: 'Auvergne-Rhône-Alpes',
        groupColor: '#ff6b6b',
      },
    });

    const marseille = await this.prisma.delegation.upsert({
      where: { tenantId_code: { tenantId, code: 'MARSEILLE' } },
      update: { name: 'Marseille' },
      create: {
        tenantId,
        name: 'Marseille',
        code: 'MARSEILLE',
        groupLabel: 'PACA',
        groupColor: '#fbbf24',
      },
    });

    this.logger.log('Organization created: 3 delegations (IDF Ouest, Lyon Métropole, Marseille)');
    return { default: idfOuest.id, idfOuest: idfOuest.id, lyon: lyon.id, marseille: marseille.id };
  }

  // ============================================================================
  // SITES - 6 sites réalistes (3 grands, 2 moyens, 1 petit)
  // ============================================================================

  private async createSites(tenantId: string, delegations: { default: string; idfOuest?: string; lyon?: string; marseille?: string }) {
    const sitesData: any[] = [
      // === GRANDS CHANTIERS (3-4 baies, équipement complet) ===
      {
        id: `demo-site-defense-${tenantId}`,
        code: 'DEF-01',
        name: 'La Défense - Tour Alto',
        status: SiteStatus.ACTIVE,
        healthStatus: HealthStatus.HEALTHY,
        address: '1 Place de la Pyramide',
        city: 'Puteaux',
        postalCode: '92800',
        country: 'France',
        contacts: [
          { name: 'Pierre Durand', phone: '+33 1 41 26 00 00', email: 'p.durand@alto.fr', role: 'Responsable IT site', isPrimary: true },
          { name: 'Marie Lefebvre', phone: '+33 6 12 34 56 78', email: 'm.lefebvre@alto.fr', role: 'Chef de site' },
        ],
        cutProcedure: 'Contacter le NOC au 01 XX XX XX XX puis basculer SD-WAN',
        notes: 'Grand site Tour Alto - 8 étages, salle IT au RDC et étage 4. Accès badge NEXITY + escorte zone serveur.',
      },
      {
        id: `demo-site-saclay-${tenantId}`,
        code: 'SAC-01',
        name: 'Saclay - Campus Sciences',
        status: SiteStatus.ACTIVE,
        healthStatus: HealthStatus.HEALTHY,
        address: '3 Rue Joliot-Curie',
        city: 'Gif-sur-Yvette',
        postalCode: '91190',
        country: 'France',
        contacts: [
          { name: 'Thomas Bernard', phone: '+33 1 69 15 00 00', email: 't.bernard@saclay.fr', role: 'DSI Campus', isPrimary: true },
        ],
        notes: 'Campus universitaire - 3 bâtiments interconnectés. WiFi haute densité (amphithéâtres 500 places).',
      },
      {
        id: `demo-site-velizy-${tenantId}`,
        code: 'VEL-01',
        name: 'Vélizy - Immeuble Omega',
        status: SiteStatus.ACTIVE,
        healthStatus: HealthStatus.WARNING,
        address: '2 Avenue de l\'Europe',
        city: 'Vélizy-Villacoublay',
        postalCode: '78140',
        country: 'France',
        contacts: [
          { name: 'Claire Moreau', phone: '+33 1 39 46 00 00', email: 'c.moreau@omega.fr', role: 'Responsable technique', isPrimary: true },
          { name: 'Julien Petit', phone: '+33 6 98 76 54 32', email: 'j.petit@omega.fr', role: 'Technicien réseau' },
        ],
        notes: 'Immeuble bureaux 5 étages. Warning: climatisation salle serveur en maintenance depuis 2 semaines.',
      },
      // === CHANTIERS MOYENS (2 baies, équipement standard) ===
      {
        id: `demo-site-stcloud-${tenantId}`,
        code: 'STC-01',
        name: 'Saint-Cloud - Résidence Parc',
        status: SiteStatus.ACTIVE,
        healthStatus: HealthStatus.HEALTHY,
        address: '15 Boulevard de la République',
        city: 'Saint-Cloud',
        postalCode: '92210',
        country: 'France',
        contacts: [
          { name: 'François Dubois', phone: '+33 1 46 02 00 00', email: 'f.dubois@residenceparc.fr', role: 'Responsable site', isPrimary: true },
        ],
        notes: 'Résidence en construction - 2 bâtiments. Salle technique au sous-sol bâtiment A.',
      },
      {
        id: `demo-site-massy-${tenantId}`,
        code: 'MAS-01',
        name: 'Massy - Pôle Atlantis',
        status: SiteStatus.ACTIVE,
        healthStatus: HealthStatus.HEALTHY,
        address: '8 Avenue Carnot',
        city: 'Massy',
        postalCode: '91300',
        country: 'France',
        contacts: [
          { name: 'Isabelle Roche', phone: '+33 1 60 13 00 00', email: 'i.roche@atlantis.fr', role: 'Directrice technique', isPrimary: true },
        ],
        notes: 'Pôle commercial et bureaux - 3 étages. Déploiement phase 2 en cours.',
      },
      // === PETIT CHANTIER (pas de baie dédiée, équipement minimal) ===
      {
        id: `demo-site-boulogne-${tenantId}`,
        code: 'BOU-01',
        name: 'Boulogne - Showroom Marcel',
        status: SiteStatus.PREPARATION,
        healthStatus: HealthStatus.UNKNOWN,
        address: '42 Rue Marcel Dassault',
        city: 'Boulogne-Billancourt',
        postalCode: '92100',
        country: 'France',
        contacts: [
          { name: 'Élodie Garnier', phone: '+33 6 45 67 89 01', email: 'e.garnier@marcel.fr', role: 'Chef de projet', isPrimary: true },
        ],
        notes: 'Petit showroom temporaire - installation prévue semaine prochaine. Pas de salle serveur, équipement sous bureau.',
      },
      // === DELEGATIONS LYON + MARSEILLE (1 site chacune — exerce multi-délégation) ===
      {
        id: `demo-site-lyon-${tenantId}`,
        code: 'LYO-01',
        name: 'Lyon - Part-Dieu',
        _delegation: 'lyon',
        status: SiteStatus.ACTIVE,
        healthStatus: HealthStatus.HEALTHY,
        address: '112 Rue Garibaldi',
        city: 'Lyon',
        postalCode: '69003',
        country: 'France',
        contacts: [
          { name: 'Romain Lacombe', phone: '+33 4 72 00 00 00', email: 'r.lacombe@lyon-partdieu.fr', role: 'Responsable site', isPrimary: true },
        ],
        notes: 'Tour Part-Dieu - 3ᵉ étage. Exploité par la délégation Lyon Métropole.',
      },
      {
        id: `demo-site-marseille-${tenantId}`,
        code: 'MRS-01',
        name: 'Marseille - Euromed',
        _delegation: 'marseille',
        status: SiteStatus.ACTIVE,
        healthStatus: HealthStatus.HEALTHY,
        address: '9 Boulevard du Littoral',
        city: 'Marseille',
        postalCode: '13002',
        country: 'France',
        contacts: [
          { name: 'Stéphanie Borel', phone: '+33 4 91 00 00 00', email: 's.borel@euromed.fr', role: 'Responsable site', isPrimary: true },
        ],
        notes: 'Quartier Euroméditerranée - bureaux et showroom. Exploité par la délégation Marseille.',
      },
    ];

    // Demo coordinates (code → [lat, lon])
    const coords: Record<string, [number, number]> = {
      'DEF-01': [48.8919, 2.2372],     // La Défense
      'SAC-01': [48.7108, 2.1665],     // Saclay
      'VEL-01': [48.7819, 2.1991],     // Vélizy
      'STC-01': [48.8427, 2.2028],     // Saint-Cloud
      'MAS-01': [48.7264, 2.2808],     // Massy
      'BOU-01': [48.8333, 2.2415],     // Boulogne
      'LYO-01': [45.7605, 4.8560],     // Lyon Part-Dieu
      'MRS-01': [43.3062, 5.3618],     // Marseille Euroméditerranée
    };

    const sites = [];
    for (const s of sitesData) {
      const { _delegation, ...siteFields } = s;
      const delegationId =
        (_delegation === 'lyon' && delegations.lyon) ||
        (_delegation === 'marseille' && delegations.marseille) ||
        (_delegation === 'idfOuest' && delegations.idfOuest) ||
        delegations.default;

      const site = await this.prisma.site.upsert({
        where: { id: siteFields.id },
        update: { delegationId }, // ensure existing sites get re-homed on seed replay
        create: {
          ...siteFields,
          tenantId,
          delegationId,
        },
      });
      const c = coords[s.code];
      if (c) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "sites" SET coordinates = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
          c[1], c[0], site.id,
        );
      }
      sites.push(site);
    }

    return sites;
  }

  // ============================================================================
  // USERS
  // ============================================================================

  private async createUsers(tenantId: string) {
    const usersData = [
      {
        id: `demo-user-admin-${tenantId}`,
        email: 'admin@demo.fr',
        name: 'Alexandre Admin',
        _right: DelegationRight.MANAGE,
        phone: '+33 6 00 00 00 01',
        isSuperAdmin: true,
      },
      {
        id: `demo-user-manager-${tenantId}`,
        email: 'manager@demo.fr',
        name: 'Sophie Martin',
        _right: DelegationRight.MANAGE,
        phone: '+33 6 12 34 56 78',
      },
      {
        id: `demo-user-tech1-${tenantId}`,
        email: 'technicien@demo.fr',
        name: 'Marc Leroy',
        _right: DelegationRight.WRITE,
        phone: '+33 6 98 76 54 32',
      },
      {
        id: `demo-user-tech2-${tenantId}`,
        email: 'technicien2@demo.fr',
        name: 'Karim Benali',
        _right: DelegationRight.WRITE,
        phone: '+33 6 55 44 33 22',
      },
      {
        id: `demo-user-viewer-${tenantId}`,
        email: 'viewer@demo.fr',
        name: 'Nathalie Rousseau',
        _right: DelegationRight.READ,
        phone: '+33 6 11 22 33 44',
      },
      // Multi-delegation demo user — MANAGE on Lyon + READ on Marseille.
      // Exercises the switcher, the "Ma délégation" tab and cross-right UX.
      {
        id: `demo-user-multideleg-${tenantId}`,
        email: 'multi@demo.fr',
        name: 'Julien Morel',
        _right: DelegationRight.MANAGE, // primary — see createUserDelegations for the full map
        phone: '+33 6 24 68 13 57',
      },
    ];

    // All demo users get password "demo123"
    const demoPasswordHash = await bcrypt.hash('demo123', 10);

    const users = [];
    for (const u of usersData) {
      const { _right, ...userData } = u;

      // Match on (tenantId, email) — Prisma's actual unique constraint — so that
      // when the setup wizard has already created an admin user with the same
      // email we gracefully reuse it instead of hitting a P2002.
      const existing = await this.prisma.user.findFirst({
        where: { tenantId, email: userData.email },
      });

      let user;
      if (existing) {
        user = await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            name: userData.name,
            phone: userData.phone,
            // Only set passwordHash if the user has none yet (preserves operator passwords)
            ...(existing.passwordHash ? {} : { passwordHash: demoPasswordHash }),
            // Keep isSuperAdmin if already true (e.g. wizard-created admin)
            ...(userData.isSuperAdmin ? { isSuperAdmin: true } : {}),
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            ...userData,
            tenantId,
            passwordHash: demoPasswordHash,
          },
        });
      }

      (user as any)._right = _right;
      users.push(user);
    }

    return users;
  }

  // ============================================================================
  // USER DELEGATIONS
  // ============================================================================

  private async createUserDelegations(
    tenantId: string,
    users: any[],
    delegations: { default: string; idfOuest?: string; lyon?: string; marseille?: string },
  ) {
    const idfOuest = delegations.idfOuest || delegations.default;
    const lyon = delegations.lyon;
    const marseille = delegations.marseille;

    // Find the admin user (setup-created, isSuperAdmin) to use as grantedBy
    const admin = await this.prisma.user.findFirst({
      where: { tenantId, isSuperAdmin: true },
    });
    const grantedById = admin?.id || users[0]?.id;

    const byEmail = (email: string) => users.find((u) => u.email === email);
    const managerUser = byEmail('manager@demo.fr');
    const multiUser = byEmail('multi@demo.fr');

    type Assignment = { userId: string; delegationId: string; right: DelegationRight };
    const assignments: Assignment[] = [];

    // All default demo users land on IDF Ouest with their primary right
    for (const user of users) {
      assignments.push({
        userId: user.id,
        delegationId: idfOuest,
        right: (user as any)._right || DelegationRight.READ,
      });
    }

    // Manager (Sophie Martin) → MANAGE on Lyon + Marseille too (audit baseline)
    if (managerUser) {
      if (lyon) assignments.push({ userId: managerUser.id, delegationId: lyon, right: DelegationRight.MANAGE });
      if (marseille) assignments.push({ userId: managerUser.id, delegationId: marseille, right: DelegationRight.MANAGE });
    }

    // Multi-delegation demo user (Julien Morel) → MANAGE on Lyon, READ on Marseille,
    // keep his IDF Ouest assignment (MANAGE) to exercise a 3-way multi-delegation setup.
    if (multiUser) {
      if (lyon) {
        // Overrides the default IDF assignment → keep IDF at MANAGE, add Lyon MANAGE, Marseille READ
        assignments.push({ userId: multiUser.id, delegationId: lyon, right: DelegationRight.MANAGE });
      }
      if (marseille) {
        assignments.push({ userId: multiUser.id, delegationId: marseille, right: DelegationRight.READ });
      }
    }

    for (const a of assignments) {
      await this.prisma.userDelegation.upsert({
        where: { userId_delegationId: { userId: a.userId, delegationId: a.delegationId } },
        update: { right: a.right },
        create: {
          tenantId,
          userId: a.userId,
          delegationId: a.delegationId,
          right: a.right,
          grantedBy: grantedById,
        },
      });
    }

    this.logger.log(`UserDelegations created: ${assignments.length} assignments across ${[idfOuest, lyon, marseille].filter(Boolean).length} delegations`);
  }

  // ============================================================================
  // RACKS
  // ============================================================================

  private async createRacks(tenantId: string, sites: any[]) {
    const defense = sites.find(s => s.code === 'DEF-01');
    const saclay = sites.find(s => s.code === 'SAC-01');
    const velizy = sites.find(s => s.code === 'VEL-01');
    const stcloud = sites.find(s => s.code === 'STC-01');
    const massy = sites.find(s => s.code === 'MAS-01');

    const racksData = [
      // === LA DÉFENSE - 4 baies ===
      { siteId: defense.id, name: 'DEF-R1', location: 'Salle serveur RDC - Rangée A', rackType: RackType.FLOOR_STANDING, heightU: 42, status: RackStatus.IN_SERVICE, notes: 'Rack principal réseau - cœur de réseau' },
      { siteId: defense.id, name: 'DEF-R2', location: 'Salle serveur RDC - Rangée A', rackType: RackType.FLOOR_STANDING, heightU: 42, status: RackStatus.IN_SERVICE, notes: 'Rack distribution étages 1-4' },
      { siteId: defense.id, name: 'DEF-R3', location: 'Salle serveur RDC - Rangée B', rackType: RackType.FLOOR_STANDING, heightU: 42, status: RackStatus.IN_SERVICE, notes: 'Rack distribution étages 5-8' },
      { siteId: defense.id, name: 'DEF-LT1', location: 'Local technique Étage 4', rackType: RackType.WALL_MOUNTED, heightU: 12, status: RackStatus.IN_SERVICE, notes: 'Rack mural local technique étage 4' },
      // === SACLAY - 3 baies ===
      { siteId: saclay.id, name: 'SAC-R1', location: 'Salle IT Bâtiment A', rackType: RackType.FLOOR_STANDING, heightU: 42, status: RackStatus.IN_SERVICE, notes: 'Rack principal - cœur réseau campus' },
      { siteId: saclay.id, name: 'SAC-R2', location: 'Salle IT Bâtiment A', rackType: RackType.FLOOR_STANDING, heightU: 42, status: RackStatus.IN_SERVICE, notes: 'Rack distribution bâtiments B et C' },
      { siteId: saclay.id, name: 'SAC-LT1', location: 'Local technique Bâtiment B', rackType: RackType.WALL_MOUNTED, heightU: 12, status: RackStatus.IN_SERVICE, notes: 'Rack mural bâtiment B - distribution étages' },
      // === VÉLIZY - 3 baies ===
      { siteId: velizy.id, name: 'VEL-R1', location: 'Salle serveur Sous-sol', rackType: RackType.FLOOR_STANDING, heightU: 42, status: RackStatus.IN_SERVICE, notes: 'Rack principal réseau' },
      { siteId: velizy.id, name: 'VEL-R2', location: 'Salle serveur Sous-sol', rackType: RackType.FLOOR_STANDING, heightU: 24, status: RackStatus.IN_SERVICE, notes: 'Rack distribution' },
      { siteId: velizy.id, name: 'VEL-LT1', location: 'Local technique Étage 3', rackType: RackType.WALL_MOUNTED, heightU: 6, status: RackStatus.IN_SERVICE, notes: 'Rack mural étage 3' },
      // === SAINT-CLOUD - 2 baies ===
      { siteId: stcloud.id, name: 'STC-R1', location: 'Salle technique Sous-sol Bat A', rackType: RackType.FLOOR_STANDING, heightU: 24, status: RackStatus.IN_SERVICE, notes: 'Rack principal bâtiment A' },
      { siteId: stcloud.id, name: 'STC-R2', location: 'Salle technique Sous-sol Bat A', rackType: RackType.WALL_MOUNTED, heightU: 12, status: RackStatus.IN_SERVICE, notes: 'Rack secondaire - distribution' },
      // === MASSY - 2 baies ===
      { siteId: massy.id, name: 'MAS-R1', location: 'Local IT RDC', rackType: RackType.FLOOR_STANDING, heightU: 24, status: RackStatus.IN_SERVICE, notes: 'Rack principal' },
      { siteId: massy.id, name: 'MAS-R2', location: 'Local IT RDC', rackType: RackType.WALL_MOUNTED, heightU: 12, status: RackStatus.IN_SERVICE, notes: 'Rack secondaire WiFi/distribution' },
    ];

    const racks = [];
    for (const r of racksData) {
      const rack = await this.prisma.rack.create({
        data: {
          tenantId,
          ...r,
        },
      });
      racks.push(rack);
    }

    return racks;
  }

  // ============================================================================
  // ASSETS - Équipements réalistes par site
  // ============================================================================

  private async createAssets(tenantId: string, sites: any[], racks: any[]) {
    const defense = sites.find(s => s.code === 'DEF-01');
    const saclay = sites.find(s => s.code === 'SAC-01');
    const velizy = sites.find(s => s.code === 'VEL-01');
    const stcloud = sites.find(s => s.code === 'STC-01');
    const massy = sites.find(s => s.code === 'MAS-01');
    const boulogne = sites.find(s => s.code === 'BOU-01');

    const defR1 = racks.find(r => r.name === 'DEF-R1');
    const defR2 = racks.find(r => r.name === 'DEF-R2');
    const defR3 = racks.find(r => r.name === 'DEF-R3');
    const defLT1 = racks.find(r => r.name === 'DEF-LT1');
    const sacR1 = racks.find(r => r.name === 'SAC-R1');
    const sacR2 = racks.find(r => r.name === 'SAC-R2');
    const sacLT1 = racks.find(r => r.name === 'SAC-LT1');
    const velR1 = racks.find(r => r.name === 'VEL-R1');
    const velR2 = racks.find(r => r.name === 'VEL-R2');
    const stcR1 = racks.find(r => r.name === 'STC-R1');
    const stcR2 = racks.find(r => r.name === 'STC-R2');
    const masR1 = racks.find(r => r.name === 'MAS-R1');
    const masR2 = racks.find(r => r.name === 'MAS-R2');

    const assetsData = [
      // =====================================================================
      // LA DÉFENSE - GRAND CHANTIER (SD-WAN Fortinet, switches, AP WiFi, imprimantes, Teams Room)
      // =====================================================================
      // SD-WAN / Firewall Fortinet
      { siteId: defense.id, rackId: defR1.id, rackPositionU: 1, rackHeightU: 1, type: 'FIREWALL', name: 'FortiGate Active', manufacturer: 'Fortinet', model: 'FortiGate 100F', serialNumber: 'FGT100F-DEF-001', status: 'IN_SERVICE', notes: 'SD-WAN principal - HA Active', networkInfo: { ip: '10.1.0.1', hostname: 'FW-DEF-01', vlan: '1', adminLinks: [{ label: 'FortiGate Console', url: 'https://10.1.0.1' }] } },
      { siteId: defense.id, rackId: defR1.id, rackPositionU: 2, rackHeightU: 1, type: 'FIREWALL', name: 'FortiGate Passive', manufacturer: 'Fortinet', model: 'FortiGate 100F', serialNumber: 'FGT100F-DEF-002', status: 'IN_SERVICE', notes: 'SD-WAN secondaire - HA Passive', networkInfo: { ip: '10.1.0.2', hostname: 'FW-DEF-02', vlan: '1', adminLinks: [{ label: 'FortiGate Console', url: 'https://10.1.0.2' }] } },
      // Switches Fortinet
      { siteId: defense.id, rackId: defR1.id, rackPositionU: 5, rackHeightU: 1, type: 'SWITCH', name: 'Switch Core Master', manufacturer: 'Fortinet', model: 'FortiSwitch 148E-POE', serialNumber: 'FS148E-DEF-001', status: 'IN_SERVICE', notes: 'Switch cœur réseau - Stack Master', networkInfo: { ip: '10.1.1.1', hostname: 'SW-DEF-CORE-01', vlan: '1', adminLinks: [{ label: 'Switch Management', url: 'https://10.1.1.1' }] } },
      { siteId: defense.id, rackId: defR1.id, rackPositionU: 6, rackHeightU: 1, type: 'SWITCH', name: 'Switch Core Member', manufacturer: 'Fortinet', model: 'FortiSwitch 148E-POE', serialNumber: 'FS148E-DEF-002', status: 'IN_SERVICE', notes: 'Switch cœur réseau - Stack Member', networkInfo: { ip: '10.1.1.2', hostname: 'SW-DEF-CORE-02', vlan: '1', adminLinks: [{ label: 'Switch Management', url: 'https://10.1.1.2' }] } },
      { siteId: defense.id, rackId: defR2.id, rackPositionU: 1, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 148E-FPOE', serialNumber: 'FS148E-DEF-003', status: 'IN_SERVICE', notes: 'Switch distribution étages 1-2', networkInfo: { ip: '10.1.2.1', hostname: 'SW-DEF-DIST-01' } },
      { siteId: defense.id, rackId: defR2.id, rackPositionU: 2, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 148E-FPOE', serialNumber: 'FS148E-DEF-004', status: 'IN_SERVICE', notes: 'Switch distribution étages 3-4', networkInfo: { ip: '10.1.2.2', hostname: 'SW-DEF-DIST-02' } },
      { siteId: defense.id, rackId: defR3.id, rackPositionU: 1, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 124E-POE', serialNumber: 'FS124E-DEF-005', status: 'IN_SERVICE', notes: 'Switch distribution étages 5-6', networkInfo: { ip: '10.1.3.1', hostname: 'SW-DEF-DIST-03' } },
      { siteId: defense.id, rackId: defR3.id, rackPositionU: 2, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 108E-POE', serialNumber: 'FS108E-DEF-006', status: 'IN_SERVICE', notes: 'Switch distribution étages 7-8', networkInfo: { ip: '10.1.3.2', hostname: 'SW-DEF-DIST-04' } },
      { siteId: defense.id, rackId: defLT1.id, rackPositionU: 1, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 108E-POE', serialNumber: 'FS108E-DEF-007', status: 'IN_SERVICE', notes: 'Switch local technique étage 4' },
      // Patch Panels
      { siteId: defense.id, rackId: defR1.id, rackPositionU: 8, rackHeightU: 1, type: 'PATCH_PANEL', manufacturer: 'Legrand', model: 'Patch Panel 48 ports Cat6a', serialNumber: 'PP-DEF-001', status: 'IN_SERVICE', notes: 'Panneau brassage cœur' },
      { siteId: defense.id, rackId: defR2.id, rackPositionU: 4, rackHeightU: 1, type: 'PATCH_PANEL', manufacturer: 'Legrand', model: 'Patch Panel 48 ports Cat6a', serialNumber: 'PP-DEF-002', status: 'IN_SERVICE', notes: 'Panneau brassage distribution 1' },
      { siteId: defense.id, rackId: defR3.id, rackPositionU: 4, rackHeightU: 1, type: 'PATCH_PANEL', manufacturer: 'Legrand', model: 'Patch Panel 48 ports Cat6a', serialNumber: 'PP-DEF-003', status: 'IN_SERVICE', notes: 'Panneau brassage distribution 2' },
      // PDUs
      { siteId: defense.id, rackId: defR1.id, rackPositionU: 40, rackHeightU: 2, type: 'PDU', manufacturer: 'APC', model: 'Rack PDU 2G Metered', serialNumber: 'PDU-DEF-001', status: 'IN_SERVICE' },
      { siteId: defense.id, rackId: defR2.id, rackPositionU: 22, rackHeightU: 2, type: 'PDU', manufacturer: 'APC', model: 'Rack PDU 2G Metered', serialNumber: 'PDU-DEF-002', status: 'IN_SERVICE' },
      // Access Points WiFi - Fortinet FortiAP
      { siteId: defense.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-DEF-001', status: 'IN_SERVICE', locationText: 'Étage 1 - Open Space', notes: 'AP WiFi 6', networkInfo: { ip: '10.1.10.11', hostname: 'AP-DEF-E1-01' } },
      { siteId: defense.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-DEF-002', status: 'IN_SERVICE', locationText: 'Étage 2 - Open Space', networkInfo: { ip: '10.1.10.12', hostname: 'AP-DEF-E2-01' } },
      { siteId: defense.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-DEF-003', status: 'IN_SERVICE', locationText: 'Étage 3 - Salle réunion', networkInfo: { ip: '10.1.10.13', hostname: 'AP-DEF-E3-01' } },
      { siteId: defense.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 431F', serialNumber: 'FAP431F-DEF-004', status: 'IN_SERVICE', locationText: 'Étage 4 - Direction', notes: 'AP WiFi 6E haute densité', networkInfo: { ip: '10.1.10.14', hostname: 'AP-DEF-E4-01' } },
      { siteId: defense.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-DEF-005', status: 'IN_SERVICE', locationText: 'Étage 5 - Open Space', networkInfo: { ip: '10.1.10.15', hostname: 'AP-DEF-E5-01' } },
      { siteId: defense.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-DEF-006', status: 'IN_SERVICE', locationText: 'Étage 6 - Open Space', networkInfo: { ip: '10.1.10.16', hostname: 'AP-DEF-E6-01' } },
      { siteId: defense.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-DEF-007', status: 'IN_SERVICE', locationText: 'Étage 7 - Salle formation', networkInfo: { ip: '10.1.10.17', hostname: 'AP-DEF-E7-01' } },
      { siteId: defense.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 431F', serialNumber: 'FAP431F-DEF-008', status: 'IN_SERVICE', locationText: 'Étage 8 - Présidence', notes: 'AP WiFi 6E haute densité', networkInfo: { ip: '10.1.10.18', hostname: 'AP-DEF-E8-01' } },
      // Imprimantes Canon
      { siteId: defense.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-DEF-IMP-001', status: 'IN_SERVICE', locationText: 'Étage 1 - Espace copie', networkInfo: { ip: '10.1.20.11', hostname: 'IMP-DEF-E1' } },
      { siteId: defense.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-DEF-IMP-002', status: 'IN_SERVICE', locationText: 'Étage 3 - Espace copie', networkInfo: { ip: '10.1.20.13', hostname: 'IMP-DEF-E3' } },
      { siteId: defense.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-DEF-IMP-003', status: 'IN_SERVICE', locationText: 'Étage 5 - Espace copie', networkInfo: { ip: '10.1.20.15', hostname: 'IMP-DEF-E5' } },
      { siteId: defense.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-DEF-IMP-004', status: 'IN_SERVICE', locationText: 'Étage 8 - Direction', networkInfo: { ip: '10.1.20.18', hostname: 'IMP-DEF-E8' } },
      // Teams Room Yealink
      { siteId: defense.id, type: 'TEAMS_ROOM', manufacturer: 'Yealink', model: 'MeetingBoard 65', serialNumber: 'YLK-DEF-TR-001', status: 'IN_SERVICE', locationText: 'Étage 4 - Salle Haussmann (12 places)', notes: 'Teams Room complète avec caméra UVC84 et micro VCM38' },
      { siteId: defense.id, type: 'TEAMS_ROOM', manufacturer: 'Yealink', model: 'MeetingBar A30', serialNumber: 'YLK-DEF-TR-002', status: 'IN_SERVICE', locationText: 'Étage 4 - Salle Rivoli (6 places)', notes: 'Teams Room pour moyenne salle' },
      { siteId: defense.id, type: 'TEAMS_ROOM', manufacturer: 'Yealink', model: 'MeetingBar A20', serialNumber: 'YLK-DEF-TR-003', status: 'IN_SERVICE', locationText: 'Étage 8 - Salle DG (4 places)', notes: 'Teams Room compacte direction' },
      // Caméras
      { siteId: defense.id, type: 'CAMERA', manufacturer: 'Axis', model: 'P3245-V', serialNumber: 'AXIS-DEF-CAM-001', status: 'IN_SERVICE', locationText: 'Hall d\'entrée RDC', networkInfo: { ip: '10.1.30.1', hostname: 'CAM-DEF-HALL' } },
      { siteId: defense.id, type: 'CAMERA', manufacturer: 'Axis', model: 'P3245-V', serialNumber: 'AXIS-DEF-CAM-002', status: 'IN_SERVICE', locationText: 'Salle serveur RDC', networkInfo: { ip: '10.1.30.2', hostname: 'CAM-DEF-SRV' } },

      // =====================================================================
      // SACLAY - GRAND CHANTIER
      // =====================================================================
      // SD-WAN Fortinet
      { siteId: saclay.id, rackId: sacR1.id, rackPositionU: 1, rackHeightU: 1, type: 'FIREWALL', name: 'FortiGate Campus', manufacturer: 'Fortinet', model: 'FortiGate 80F', serialNumber: 'FGT80F-SAC-001', status: 'IN_SERVICE', notes: 'SD-WAN campus', networkInfo: { ip: '10.2.0.1', hostname: 'FW-SAC-01', adminLinks: [{ label: 'FortiGate Console', url: 'https://10.2.0.1' }] } },
      // Switches Fortinet
      { siteId: saclay.id, rackId: sacR1.id, rackPositionU: 3, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 148E-POE', serialNumber: 'FS148E-SAC-001', status: 'IN_SERVICE', notes: 'Switch cœur campus', networkInfo: { ip: '10.2.1.1', hostname: 'SW-SAC-CORE-01' } },
      { siteId: saclay.id, rackId: sacR2.id, rackPositionU: 1, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 148E-FPOE', serialNumber: 'FS148E-SAC-002', status: 'IN_SERVICE', notes: 'Switch distribution bâtiment B' },
      { siteId: saclay.id, rackId: sacR2.id, rackPositionU: 2, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 148E-FPOE', serialNumber: 'FS148E-SAC-003', status: 'IN_SERVICE', notes: 'Switch distribution bâtiment C' },
      { siteId: saclay.id, rackId: sacLT1.id, rackPositionU: 1, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 108E-POE', serialNumber: 'FS108E-SAC-004', status: 'IN_SERVICE', notes: 'Switch local technique bat B' },
      // Patch Panels
      { siteId: saclay.id, rackId: sacR1.id, rackPositionU: 5, rackHeightU: 1, type: 'PATCH_PANEL', manufacturer: 'Legrand', model: 'Patch Panel 48 ports Cat6a', serialNumber: 'PP-SAC-001', status: 'IN_SERVICE' },
      // AP WiFi Fortinet
      { siteId: saclay.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 431F', serialNumber: 'FAP431F-SAC-001', status: 'IN_SERVICE', locationText: 'Bâtiment A - Amphithéâtre 1', notes: 'AP haute densité WiFi 6E', networkInfo: { ip: '10.2.10.1', hostname: 'AP-SAC-A-AMPHI1' } },
      { siteId: saclay.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 431F', serialNumber: 'FAP431F-SAC-002', status: 'IN_SERVICE', locationText: 'Bâtiment A - Amphithéâtre 2', networkInfo: { ip: '10.2.10.2', hostname: 'AP-SAC-A-AMPHI2' } },
      { siteId: saclay.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-SAC-003', status: 'IN_SERVICE', locationText: 'Bâtiment B - RDC Accueil', networkInfo: { ip: '10.2.10.3', hostname: 'AP-SAC-B-RDC' } },
      { siteId: saclay.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-SAC-004', status: 'IN_SERVICE', locationText: 'Bâtiment B - Étage 1', networkInfo: { ip: '10.2.10.4', hostname: 'AP-SAC-B-E1' } },
      { siteId: saclay.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-SAC-005', status: 'IN_SERVICE', locationText: 'Bâtiment C - Cafétéria', networkInfo: { ip: '10.2.10.5', hostname: 'AP-SAC-C-CAF' } },
      { siteId: saclay.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-SAC-006', status: 'IN_SERVICE', locationText: 'Bâtiment C - Bibliothèque', networkInfo: { ip: '10.2.10.6', hostname: 'AP-SAC-C-BIB' } },
      // Imprimantes Canon
      { siteId: saclay.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-SAC-IMP-001', status: 'IN_SERVICE', locationText: 'Bâtiment A - Secrétariat' },
      { siteId: saclay.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-SAC-IMP-002', status: 'IN_SERVICE', locationText: 'Bâtiment B - Salle profs' },
      { siteId: saclay.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-SAC-IMP-003', status: 'IN_SERVICE', locationText: 'Bâtiment C - Administration' },
      // Teams Room
      { siteId: saclay.id, type: 'TEAMS_ROOM', manufacturer: 'Yealink', model: 'MeetingBoard 65', serialNumber: 'YLK-SAC-TR-001', status: 'IN_SERVICE', locationText: 'Bâtiment A - Salle Conseil', notes: 'Salle de conseil 20 places' },
      { siteId: saclay.id, type: 'TEAMS_ROOM', manufacturer: 'Yealink', model: 'MeetingBar A30', serialNumber: 'YLK-SAC-TR-002', status: 'IN_SERVICE', locationText: 'Bâtiment B - Salle réunion 1' },

      // =====================================================================
      // VÉLIZY - GRAND CHANTIER
      // =====================================================================
      // SD-WAN Fortinet
      { siteId: velizy.id, rackId: velR1.id, rackPositionU: 1, rackHeightU: 1, type: 'FIREWALL', name: 'FortiGate Omega', manufacturer: 'Fortinet', model: 'FortiGate 80F', serialNumber: 'FGT80F-VEL-001', status: 'IN_SERVICE', notes: 'SD-WAN principal', networkInfo: { ip: '10.3.0.1', hostname: 'FW-VEL-01', adminLinks: [{ label: 'FortiGate Console', url: 'https://10.3.0.1' }] } },
      // Switches Fortinet
      { siteId: velizy.id, rackId: velR1.id, rackPositionU: 3, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 148E-POE', serialNumber: 'FS148E-VEL-001', status: 'IN_SERVICE', notes: 'Switch cœur', networkInfo: { ip: '10.3.1.1', hostname: 'SW-VEL-CORE-01' } },
      { siteId: velizy.id, rackId: velR1.id, rackPositionU: 4, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 124E-POE', serialNumber: 'FS124E-VEL-002', status: 'IN_SERVICE', notes: 'Switch distribution étages 1-3' },
      { siteId: velizy.id, rackId: velR2.id, rackPositionU: 1, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 124E-POE', serialNumber: 'FS124E-VEL-003', status: 'IN_SERVICE', notes: 'Switch distribution étages 4-5' },
      // AP WiFi Fortinet
      { siteId: velizy.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-VEL-001', status: 'IN_SERVICE', locationText: 'Étage 1 - Open Space' },
      { siteId: velizy.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-VEL-002', status: 'IN_SERVICE', locationText: 'Étage 2 - Open Space' },
      { siteId: velizy.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-VEL-003', status: 'IN_SERVICE', locationText: 'Étage 3 - Salles réunion' },
      { siteId: velizy.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-VEL-004', status: 'IN_SERVICE', locationText: 'Étage 4 - Open Space' },
      // Imprimantes Canon
      { siteId: velizy.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-VEL-IMP-001', status: 'IN_SERVICE', locationText: 'Étage 1 - Zone copie' },
      { siteId: velizy.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-VEL-IMP-002', status: 'IN_SERVICE', locationText: 'Étage 3 - Zone copie' },
      { siteId: velizy.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-VEL-IMP-003', status: 'OUT_OF_SERVICE', locationText: 'Étage 5 - Zone copie', notes: 'En panne - ticket support Canon ouvert' },
      // Teams Room
      { siteId: velizy.id, type: 'TEAMS_ROOM', manufacturer: 'Yealink', model: 'MeetingBar A30', serialNumber: 'YLK-VEL-TR-001', status: 'IN_SERVICE', locationText: 'Étage 2 - Salle Concorde (8 places)' },
      { siteId: velizy.id, type: 'TEAMS_ROOM', manufacturer: 'Yealink', model: 'MeetingBar A20', serialNumber: 'YLK-VEL-TR-002', status: 'IN_SERVICE', locationText: 'Étage 4 - Salle Opéra (4 places)' },

      // =====================================================================
      // SAINT-CLOUD - MOYEN CHANTIER
      // =====================================================================
      // SD-WAN
      { siteId: stcloud.id, rackId: stcR1.id, rackPositionU: 1, rackHeightU: 1, type: 'FIREWALL', name: 'FortiGate Parc', manufacturer: 'Fortinet', model: 'FortiGate 60F', serialNumber: 'FGT60F-STC-001', status: 'IN_SERVICE', notes: 'SD-WAN', networkInfo: { ip: '10.4.0.1', hostname: 'FW-STC-01', adminLinks: [{ label: 'FortiGate Console', url: 'https://10.4.0.1' }] } },
      // Switches Fortinet
      { siteId: stcloud.id, rackId: stcR1.id, rackPositionU: 3, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 124E-POE', serialNumber: 'FS124E-STC-001', status: 'IN_SERVICE', notes: 'Switch principal' },
      { siteId: stcloud.id, rackId: stcR2.id, rackPositionU: 1, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 108E-POE', serialNumber: 'FS108E-STC-002', status: 'IN_SERVICE', notes: 'Switch distribution' },
      // AP WiFi Fortinet
      { siteId: stcloud.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-STC-001', status: 'IN_SERVICE', locationText: 'Bâtiment A - RDC Hall' },
      { siteId: stcloud.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-STC-002', status: 'IN_SERVICE', locationText: 'Bâtiment A - Étage 1' },
      { siteId: stcloud.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-STC-003', status: 'IN_SERVICE', locationText: 'Bâtiment B - RDC' },
      { siteId: stcloud.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-STC-004', status: 'IN_SERVICE', locationText: 'Bâtiment B - Étage 1' },
      // Imprimantes Canon
      { siteId: stcloud.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-STC-IMP-001', status: 'IN_SERVICE', locationText: 'Bâtiment A - RDC Accueil' },
      { siteId: stcloud.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-STC-IMP-002', status: 'IN_SERVICE', locationText: 'Bâtiment B - Étage 1 Bureau' },
      // Teams Room
      { siteId: stcloud.id, type: 'TEAMS_ROOM', manufacturer: 'Yealink', model: 'MeetingBar A20', serialNumber: 'YLK-STC-TR-001', status: 'IN_SERVICE', locationText: 'Bâtiment A - Salle réunion (6 places)' },

      // =====================================================================
      // MASSY - MOYEN CHANTIER
      // =====================================================================
      // SD-WAN
      { siteId: massy.id, rackId: masR1.id, rackPositionU: 1, rackHeightU: 1, type: 'FIREWALL', name: 'FortiGate Atlantis', manufacturer: 'Fortinet', model: 'FortiGate 60F', serialNumber: 'FGT60F-MAS-001', status: 'IN_SERVICE', notes: 'SD-WAN', networkInfo: { ip: '10.5.0.1', hostname: 'FW-MAS-01', adminLinks: [{ label: 'FortiGate Console', url: 'https://10.5.0.1' }] } },
      // Switches Fortinet
      { siteId: massy.id, rackId: masR1.id, rackPositionU: 3, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 124E-POE', serialNumber: 'FS124E-MAS-001', status: 'IN_SERVICE', notes: 'Switch principal' },
      { siteId: massy.id, rackId: masR2.id, rackPositionU: 1, rackHeightU: 1, type: 'SWITCH', manufacturer: 'Fortinet', model: 'FortiSwitch 108E-POE', serialNumber: 'FS108E-MAS-002', status: 'IN_SERVICE', notes: 'Switch distribution WiFi' },
      // AP WiFi Fortinet
      { siteId: massy.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-MAS-001', status: 'IN_SERVICE', locationText: 'RDC - Zone commerciale' },
      { siteId: massy.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-MAS-002', status: 'IN_SERVICE', locationText: 'Étage 1 - Bureaux' },
      { siteId: massy.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-MAS-003', status: 'IN_SERVICE', locationText: 'Étage 2 - Open Space' },
      { siteId: massy.id, type: 'WIFI_AP', manufacturer: 'Fortinet', model: 'FortiAP 231F', serialNumber: 'FAP231F-MAS-004', status: 'IN_SERVICE', locationText: 'Étage 3 - Direction' },
      // Imprimantes Canon
      { siteId: massy.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-MAS-IMP-001', status: 'IN_SERVICE', locationText: 'Étage 1 - Zone copie' },
      { siteId: massy.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-MAS-IMP-002', status: 'IN_SERVICE', locationText: 'Étage 3 - Direction' },
      // Teams Room
      { siteId: massy.id, type: 'TEAMS_ROOM', manufacturer: 'Yealink', model: 'MeetingBar A30', serialNumber: 'YLK-MAS-TR-001', status: 'IN_SERVICE', locationText: 'Étage 2 - Salle réunion (8 places)' },

      // =====================================================================
      // BOULOGNE - PETIT CHANTIER (pas de baie, équipement minimal)
      // =====================================================================
      { siteId: boulogne.id, type: 'ROUTER', manufacturer: 'TP-Link', model: 'Deco X80-5G', serialNumber: 'TPL5G-BOU-001', status: 'IN_SERVICE', locationText: 'Sous bureau accueil', notes: 'Routeur 5G principal - débit 300 Mbps' },
      { siteId: boulogne.id, type: 'PRINTER', manufacturer: 'Canon', model: 'imagePRESS C5800', serialNumber: 'CAN-BOU-IMP-001', status: 'STOCK', locationText: 'Réserve', notes: 'Pas encore installée' },
    ];

    const assets = [];
    for (const a of assetsData) {
      const site = sites.find(s => s.id === a.siteId);
      // ADR-018 — split former networkInfo JSON into scalar columns +
      // AssetAdminLink rows. The data array still uses the historical inline
      // networkInfo shape for readability; the conversion happens here.
      const ni: any = (a as any).networkInfo ?? {};
      const adminLinks: Array<{ label: string; url: string }> = Array.isArray(ni.adminLinks)
        ? ni.adminLinks.filter((l: any) => l?.label && l?.url)
        : [];
      const { networkInfo: _drop, ...assetFields } = a as any;
      const asset = await this.prisma.asset.create({
        data: {
          tenantId,
          delegationId: site?.delegationId,
          ...assetFields,
          ip:       ni.ip       ?? null,
          mac:      ni.mac      ?? null,
          hostname: ni.hostname ?? null,
          vlan:     ni.vlan     ?? null,
          port:     ni.port     ?? null,
          adminLinks: adminLinks.length
            ? { create: adminLinks.map((l, idx) => ({ label: l.label, url: l.url, order: idx })) }
            : undefined,
        },
      });
      assets.push(asset);
    }

    return assets;
  }

  // ============================================================================
  // TASKS
  // ============================================================================

  private async createTasks(tenantId: string, sites: any[], users: any[], assets: any[]) {
    const defense = sites.find(s => s.code === 'DEF-01');
    const saclay = sites.find(s => s.code === 'SAC-01');
    const velizy = sites.find(s => s.code === 'VEL-01');
    const stcloud = sites.find(s => s.code === 'STC-01');
    const massy = sites.find(s => s.code === 'MAS-01');
    const boulogne = sites.find(s => s.code === 'BOU-01');

    const manager = users.find(u => u.name === 'Sophie Martin');
    const tech1 = users.find(u => u.name === 'Marc Leroy');
    const tech2 = users.find(u => u.name === 'Karim Benali');

    const impVelHS = assets.find(a => a.serialNumber === 'CAN-VEL-IMP-003');
    const impBouStock = assets.find(a => a.serialNumber === 'CAN-BOU-IMP-001');

    const tasksData = [
      // Défense
      { siteId: defense.id, title: 'Remplacement switch étage 7', description: 'Le FortiSwitch 108E-POE montre des erreurs CRC sur ports 1-8. Prévoir remplacement sous contrat Fortinet.', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, assignedTo: tech1?.id, createdBy: manager?.id || tech1?.id, dueDate: new Date(Date.now() + 3 * 24 * 3600000) },
      { siteId: defense.id, title: 'Mise à jour firmware FortiGate', description: 'Passer les 2 FortiGate 100F en FortiOS 7.4.3. Planifier fenêtre maintenance nuit.', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, assignedTo: tech1?.id, createdBy: manager?.id || tech1?.id, dueDate: new Date(Date.now() + 14 * 24 * 3600000) },
      { siteId: defense.id, title: 'Ajout AP WiFi étage 2 - zone meeting', description: 'Couverture WiFi insuffisante dans la nouvelle zone meeting étage 2. Commander et installer 1 FortiAP 231F supplémentaire.', status: TaskStatus.TODO, priority: TaskPriority.LOW, assignedTo: tech2?.id, createdBy: manager?.id || tech2?.id },
      // Saclay
      { siteId: saclay.id, title: 'Optimisation WiFi amphithéâtres', description: 'Ajuster les canaux et puissance des FortiAP 431F dans les amphithéâtres. Pic de charge pendant les cours (500 utilisateurs).', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, assignedTo: tech2?.id, createdBy: manager?.id || tech2?.id, dueDate: new Date(Date.now() + 5 * 24 * 3600000) },
      { siteId: saclay.id, title: 'Câblage réseau bâtiment C - étage 2', description: 'Tirer 24 prises RJ45 Cat6a pour le nouvel open space bâtiment C étage 2.', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, createdBy: manager?.id || tech1?.id, dueDate: new Date(Date.now() + 21 * 24 * 3600000) },
      // Vélizy
      { siteId: velizy.id, title: 'Réparation imprimante étage 5', description: 'Imprimante Canon C5800 en panne. Ticket Canon #INC-2024-4521 ouvert. Attente pièce de rechange.', status: TaskStatus.BLOCKED, priority: TaskPriority.MEDIUM, assignedTo: tech1?.id, createdBy: manager?.id || tech1?.id, assetId: impVelHS?.id },
      { siteId: velizy.id, title: 'Vérification climatisation salle serveur', description: 'Alerte température salle serveur. Climatisation en maintenance depuis 2 semaines. Vérifier état et planifier intervention Dalkia.', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT, assignedTo: tech1?.id, createdBy: manager?.id || tech1?.id, dueDate: new Date(Date.now() + 1 * 24 * 3600000) },
      // Saint-Cloud
      { siteId: stcloud.id, title: 'Test réseau bâtiment B', description: 'Valider le déploiement réseau complet bâtiment B : connectivité, WiFi, VLAN, QoS.', status: TaskStatus.TODO, priority: TaskPriority.HIGH, assignedTo: tech2?.id, createdBy: manager?.id || tech2?.id, dueDate: new Date(Date.now() + 7 * 24 * 3600000) },
      // Massy
      { siteId: massy.id, title: 'Configuration VLAN zone commerciale', description: 'Séparer le réseau zone commerciale (VLAN 100) du réseau bureaux (VLAN 200). Configurer inter-VLAN routing sur FortiGate.', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM, assignedTo: tech2?.id, createdBy: manager?.id || tech2?.id },
      // Boulogne
      { siteId: boulogne.id, title: 'Installation complète showroom', description: 'Installer la box 5G, configurer le WiFi, brancher l\'imprimante, tester la connectivité. Prévoir 1 journée sur site.', status: TaskStatus.TODO, priority: TaskPriority.HIGH, assignedTo: tech1?.id, createdBy: manager?.id || tech1?.id, assetId: impBouStock?.id, dueDate: new Date(Date.now() + 5 * 24 * 3600000) },
      // Tâches terminées
      { siteId: defense.id, title: 'Installation Teams Room salle Haussmann', description: 'Installation et configuration du MeetingBoard 65 Yealink dans la salle Haussmann étage 4.', status: TaskStatus.DONE, priority: TaskPriority.HIGH, assignedTo: tech1?.id, createdBy: manager?.id || tech1?.id, completedAt: new Date(Date.now() - 5 * 24 * 3600000) },
      { siteId: saclay.id, title: 'Déploiement AP WiFi bibliothèque', description: 'Installation du FortiAP 231F dans la bibliothèque bâtiment C. Configuration SSID et profil de sécurité FortiGate.', status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, assignedTo: tech2?.id, createdBy: manager?.id || tech2?.id, completedAt: new Date(Date.now() - 3 * 24 * 3600000) },
    ];

    const tasks = [];
    for (const t of tasksData) {
      const task = await this.prisma.task.create({
        data: {
          tenantId,
          ...t,
        },
      });
      tasks.push(task);
    }

    return tasks;
  }

  // ============================================================================
  // CONTACT TYPES
  // ============================================================================

  private async createContactTypes(tenantId: string) {
    const types = [];

    const systemTypes = [
      { name: 'Télécommunications', slug: 'telecommunications', category: ContactCategory.PROVIDER, color: '#3B82F6', icon: 'Phone' },
      { name: 'Internet & Réseau', slug: 'internet-reseau', category: ContactCategory.PROVIDER, color: '#8B5CF6', icon: 'Wifi' },
      { name: 'Cloud & Hosting', slug: 'cloud-hosting', category: ContactCategory.PROVIDER, color: '#06B6D4', icon: 'Cloud' },
      { name: 'Hébergement', slug: 'hebergement', category: ContactCategory.PROVIDER, color: '#14B8A6', icon: 'Server' },
      { name: 'Sécurité', slug: 'securite', category: ContactCategory.PROVIDER, color: '#EF4444', icon: 'Shield' },
      { name: 'Réseau & Infra', slug: 'reseau-infra', category: ContactCategory.TECHNICAL, color: '#F59E0B', icon: 'Network' },
      { name: 'Maintenance', slug: 'maintenance', category: ContactCategory.TECHNICAL, color: '#10B981', icon: 'Wrench' },
      { name: 'Énergie', slug: 'energie', category: ContactCategory.PROVIDER, color: '#F97316', icon: 'Zap' },
    ];

    for (const t of systemTypes) {
      const ct = await this.prisma.contactType.upsert({
        where: { tenantId_slug: { tenantId, slug: t.slug } },
        update: {},
        create: { tenantId, ...t, isSystem: true, isActive: true },
      });
      types.push(ct);
    }

    const customTypes = [
      { name: 'Climatisation', slug: 'climatisation', category: ContactCategory.TECHNICAL, color: '#0EA5E9', icon: 'Wind' },
      { name: 'Plomberie', slug: 'plomberie', category: ContactCategory.TECHNICAL, color: '#6366F1', icon: 'Droplets' },
    ];

    for (const t of customTypes) {
      const ct = await this.prisma.contactType.upsert({
        where: { tenantId_slug: { tenantId, slug: t.slug } },
        update: {},
        create: { tenantId, ...t, isSystem: false, isActive: true },
      });
      types.push(ct);
    }

    return types;
  }

  // ============================================================================
  // CONTACTS
  // ============================================================================

  private async createContacts(tenantId: string, contactTypes: any[]) {
    const contacts = [];

    const telecom = contactTypes.find(t => t.slug === 'telecommunications');
    const internet = contactTypes.find(t => t.slug === 'internet-reseau');
    const cloud = contactTypes.find(t => t.slug === 'cloud-hosting');
    const securite = contactTypes.find(t => t.slug === 'securite');
    const reseau = contactTypes.find(t => t.slug === 'reseau-infra');
    const energie = contactTypes.find(t => t.slug === 'energie');
    const maintenance = contactTypes.find(t => t.slug === 'maintenance');
    const climatisation = contactTypes.find(t => t.slug === 'climatisation');

    const contactData = [
      { name: 'Orange Business Services', typeId: telecom.id, email: 'support@orange-business.com', phone: '3900', company: 'Orange', role: 'Opérateur fibre & MPLS', notes: 'Contrat cadre liaisons FTTH/FTTO. Ref contrat: OBS-2024-FR-1234' },
      { name: 'SFR Business', typeId: telecom.id, email: 'pro@sfr.fr', phone: '1023', company: 'SFR', role: 'Opérateur fibre', notes: 'Liaisons fibre Saclay' },
      { name: 'Bouygues Telecom Entreprises', typeId: telecom.id, email: 'pro@bouyguestelecom.fr', phone: '1064', company: 'Bouygues Telecom', role: 'Opérateur mobile & fibre', notes: 'Liaisons 4G/5G backup. Contrat Bouygues Entreprises multi-sites.' },
      { name: 'Convergence', typeId: internet.id, email: 'support@convergence-groupe.com', phone: '+33 1 55 17 00 00', company: 'Convergence', role: 'Opérateur télécom & réseau', notes: 'Liaisons 4G backup sites Vélizy et Massy. Support 24/7.' },
      { name: 'Free Pro', typeId: internet.id, email: 'support-pro@free.fr', phone: '3244', company: 'Free Pro', role: 'Opérateur fibre entreprise', notes: 'Liaison FTTH principale site Massy.' },
      { name: 'Fortinet France', typeId: securite.id, email: 'support-fr@fortinet.com', phone: '+33 1 72 52 40 00', company: 'Fortinet', role: 'Support SD-WAN, Switches, WiFi & Sécurité', notes: 'Contrat FortiCare Premium sur tous les FortiGate, FortiSwitch et FortiAP. TAC 24/7.' },
      { name: 'Canon France', typeId: maintenance.id, email: 'support@canon.fr', phone: '01 70 48 05 00', company: 'Canon', role: 'Support imprimantes', notes: 'Contrat maintenance imagePRESS C5800 sur tous les sites. Intervention J+1.' },
      { name: 'Yealink France', typeId: reseau.id, email: 'support-fr@yealink.com', phone: '+33 1 84 88 40 00', company: 'Yealink', role: 'Support Teams Room', notes: 'Support technique sur MeetingBoard et MeetingBar' },
      { name: 'OVHcloud', typeId: cloud.id, email: 'support@ovhcloud.com', phone: '+33 9 72 10 10 07', company: 'OVH', role: 'Hébergement cloud', notes: 'Hébergement cloud et serveurs dédiés' },
      { name: 'Engie Solutions', typeId: energie.id, email: 'contact@engie.com', phone: '09 69 39 99 93', company: 'Engie', role: 'Fournisseur énergie', notes: 'Fourniture électrique et groupes électrogènes' },
      { name: 'Dalkia CVC', typeId: climatisation.id, email: 'support@dalkia.fr', phone: '01 55 60 29 29', company: 'Dalkia', role: 'Maintenance CVC', notes: 'Contrat maintenance climatisation salles serveurs. Intervention < 4h.' },
    ];

    for (const c of contactData) {
      const contact = await this.prisma.contact.create({
        data: { tenantId, ...c, isActive: true },
      });
      contacts.push(contact);
    }

    return contacts;
  }

  // ============================================================================
  // v1.4 EXTENSIONS (post audit phase 4)
  // ============================================================================

  /**
   * Write tenant-level appearance defaults (ADR-010) unless already present.
   * Uses the tenant's primaryColor as the default primary.
   */
  private async ensureTenantAppearanceDefaults(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return;
    const config = (tenant.config as Record<string, any>) || {};
    if (config.appearance) return; // don't stomp operator-tuned values

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        config: {
          ...config,
          appearance: {
            theme: 'system',
            primaryColor: tenant.primaryColor || '#0070f3',
            density: 'comfortable',
            allowUserOverride: true,
          },
        },
      },
    });
    this.logger.log('Tenant appearance defaults initialised');
  }

  /**
   * Seed AccessOverride examples — one ALLOW (temporary elevation) and one DENY
   * (site blacklist) so the audit flow is exercised end-to-end.
   */
  private async createAccessOverrides(tenantId: string, users: any[], sites: any[]) {
    const viewer = users.find((u) => u.email === 'viewer@demo.fr');
    const tech = users.find((u) => u.email === 'technicien@demo.fr');
    const defense = sites.find((s) => s.code === 'DEF-01');
    const boulogne = sites.find((s) => s.code === 'BOU-01');
    if (!viewer || !tech || !defense || !boulogne) return;

    const admin = await this.prisma.user.findFirst({ where: { tenantId, isSuperAdmin: true } });

    await this.prisma.accessOverride.upsert({
      where: {
        tenantId_userId_siteId_resource: {
          tenantId,
          userId: viewer.id,
          siteId: defense.id,
          resource: '*',
        },
      },
      update: {},
      create: {
        tenantId,
        userId: viewer.id,
        siteId: defense.id,
        resource: '*',
        effect: 'ALLOW',
        permission: 'WRITE',
        label: 'Intervention ponctuelle La Défense',
        grantedBy: admin?.id,
      },
    });

    await this.prisma.accessOverride.upsert({
      where: {
        tenantId_userId_siteId_resource: {
          tenantId,
          userId: tech.id,
          siteId: boulogne.id,
          resource: '*',
        },
      },
      update: {},
      create: {
        tenantId,
        userId: tech.id,
        siteId: boulogne.id,
        resource: '*',
        effect: 'DENY',
        permission: null,
        label: 'Chantier sensible — accès interdit',
        grantedBy: admin?.id,
      },
    });

    this.logger.log('AccessOverrides created: 1 ALLOW + 1 DENY');
  }

  /**
   * Seed a few BillingEntity + Budget + Expense + CostAllocation rows to exercise
   * the Coûts module end-to-end.
   */
  private async createDemoBudgetsAndExpenses(
    tenantId: string,
    delegations: { default: string; idfOuest?: string; lyon?: string; marseille?: string },
    sites: any[],
    users: any[],
  ) {
    const admin = users.find((u) => u.isSuperAdmin) || users[0];
    const defense = sites.find((s) => s.code === 'DEF-01');
    const idfOuest = delegations.idfOuest || delegations.default;

    // Billing entities (bearer + a couple of allocation targets)
    const bearer = await this.prisma.billingEntity.upsert({
      where: { tenantId_code: { tenantId, code: 'DSI-IT' } },
      update: {},
      create: {
        tenantId,
        name: 'DSI - Budget IT',
        code: 'DSI-IT',
        type: 'DIRECTION',
        description: 'Budget IT central supportant les dépenses transverses',
        delegationId: null,
      },
    });
    const bu1 = await this.prisma.billingEntity.upsert({
      where: { tenantId_code: { tenantId, code: 'BU-IDF' } },
      update: {},
      create: {
        tenantId,
        name: 'BU Île-de-France',
        code: 'BU-IDF',
        type: 'BU',
        delegationId: idfOuest,
      },
    });
    const bu2 = await this.prisma.billingEntity.upsert({
      where: { tenantId_code: { tenantId, code: 'BU-LYON' } },
      update: {},
      create: {
        tenantId,
        name: 'BU Lyon',
        code: 'BU-LYON',
        type: 'BU',
        delegationId: delegations.lyon || null,
      },
    });

    // Annual delegation-level budget for IDF Ouest, then a nested CdC budget
    // for BU-IDF (demonstrates the Délégation → Centre de coût hierarchy
    // introduced in phase 6.7 / D1).
    const budgetYear = new Date().getFullYear();
    const parentLabel = `Budget IT ${budgetYear} — IDF Ouest`;
    let parentBudget = await this.prisma.budget.findFirst({
      where: { tenantId, label: parentLabel },
    });
    if (!parentBudget) {
      parentBudget = await this.prisma.budget.create({
        data: {
          tenantId,
          label: parentLabel,
          delegationId: idfOuest,
          expenseType: null,
          period: 'YEAR',
          startDate: new Date(budgetYear, 0, 1),
          endDate: new Date(budgetYear, 11, 31),
          amount: 120000 as any,
          currency: 'EUR',
          notes:
            'Budget annuel IT couvrant équipement, services et abonnements de la délégation IDF Ouest.',
        },
      });
    }

    const cdcBudgetLabel = `Budget BU IDF ${budgetYear}`;
    const existingCdcBudget = await this.prisma.budget.findFirst({
      where: { tenantId, label: cdcBudgetLabel },
    });
    if (!existingCdcBudget) {
      await this.prisma.budget.create({
        data: {
          tenantId,
          label: cdcBudgetLabel,
          delegationId: idfOuest,
          billingEntityId: bu1.id,
          parentId: parentBudget.id,
          expenseType: null,
          period: 'YEAR',
          startDate: new Date(budgetYear, 0, 1),
          endDate: new Date(budgetYear, 11, 31),
          amount: 40000 as any,
          currency: 'EUR',
          notes:
            "Sous-budget porté par la BU IDF (partie de l'enveloppe IDF Ouest). Démo hiérarchie Délégation → CdC.",
          alertThresholdPct: 75,
        },
      });
    }

    // A recurring expense with a split allocation (60% BU IDF, 40% BU Lyon)
    const expenseLabel = 'Abonnement fibre Orange Business — La Défense';
    const existingExpense = await this.prisma.expense.findFirst({
      where: { tenantId, label: expenseLabel },
    });
    if (!existingExpense && defense) {
      const expense = await this.prisma.expense.create({
        data: {
          tenantId,
          label: expenseLabel,
          description: 'Liaison fibre dédiée 1 Gbps Orange Business (facturation mensuelle)',
          type: 'SERVICE',
          totalAmount: 890,
          currency: 'EUR',
          frequency: 'MONTHLY',
          dateIncurred: new Date(),
          bearerId: bearer.id,
          delegationId: idfOuest,
          siteId: defense.id,
          invoiceRef: 'OBS-2026-04-001',
          createdBy: admin.id,
        },
      });

      await this.prisma.costAllocation.createMany({
        data: [
          { expenseId: expense.id, targetId: bu1.id, percentage: 60, amount: 534 },
          { expenseId: expense.id, targetId: bu2.id, percentage: 40, amount: 356 },
        ],
      });
    }

    this.logger.log('Demo budgets & expenses seeded');
  }

  /**
   * Seed realistic connectivity links for all demo sites. Phase 6.5: this is
   * now the canonical place where connectivity data lives (the legacy
   * Site.connectivity JSON column was dropped).
   */
  private async createConnectivityLinksForDemo(tenantId: string, sites: any[], assets: any[]): Promise<any[]> {
    const created: any[] = [];
    // Which piece of on-site equipment actually terminates the PRIMARY link.
    // Empty/missing asset → link stays asset-less (fine, the FK is nullable).
    const primaryAssetBySite: Record<string, string /* serialNumber */ | undefined> = {
      'DEF-01': 'FGT100F-DEF-001',
      'SAC-01': 'FGT80F-SAC-001',
      'VEL-01': 'FGT80F-VEL-001',
      'STC-01': 'FGT60F-STC-001',
      'MAS-01': 'FGT60F-MAS-001',
      'BOU-01': 'TPL5G-BOU-001',
    };

    const data: Array<{
      siteCode: string;
      role: 'PRIMARY' | 'BACKUP';
      provider: string;
      type: string;
      bandwidthDown?: number;
      bandwidthUp?: number;
      monthlyPrice?: number;
      contractRef?: string;
      publicIp?: string;
    }> = [
      // Providers below MUST match an existing PROVIDER contact's `name`
      // verbatim — the ConnectivityLinksManager Combobox filters by contact
      // name. Any mismatch here will make the provider field look empty in
      // the UI (placeholder). If you add a new provider, add the matching
      // contact in createContacts first.
      // publicIp uses RFC5737 TEST-NET ranges + a couple of well-known public
      // IPs of French ISPs so monitor `defaultTarget` is pre-filled and
      // ICMP/HTTP probes return realistic values during demo.
      // La Défense — Tour Alto (grand site, fibre dédiée + 4G/5G backup)
      { siteCode: 'DEF-01', role: 'PRIMARY', provider: 'Orange Business Services', type: 'FIBER', bandwidthDown: 1000, bandwidthUp: 1000, monthlyPrice: 890, contractRef: 'FTTO-DEF-001', publicIp: '193.252.122.103' },
      { siteCode: 'DEF-01', role: 'BACKUP', provider: 'Bouygues Telecom Entreprises', type: '4G', bandwidthDown: 300, bandwidthUp: 50, monthlyPrice: 59, contractRef: '4G-DEF-001', publicIp: '194.158.122.10' },
      // Saclay — Campus Sciences
      { siteCode: 'SAC-01', role: 'PRIMARY', provider: 'SFR Business', type: 'FIBER', bandwidthDown: 500, bandwidthUp: 200, monthlyPrice: 620, contractRef: 'FTTH-SAC-001', publicIp: '80.231.84.42' },
      { siteCode: 'SAC-01', role: 'BACKUP', provider: 'Bouygues Telecom Entreprises', type: '5G', bandwidthDown: 200, bandwidthUp: 40, monthlyPrice: 49, contractRef: '5G-SAC-001', publicIp: '194.158.122.11' },
      // Vélizy — Immeuble Omega
      { siteCode: 'VEL-01', role: 'PRIMARY', provider: 'Bouygues Telecom Entreprises', type: 'FIBER', bandwidthDown: 500, bandwidthUp: 200, monthlyPrice: 420, contractRef: 'FTTH-VEL-001', publicIp: '194.158.122.12' },
      { siteCode: 'VEL-01', role: 'BACKUP', provider: 'Convergence', type: '4G', bandwidthDown: 150, bandwidthUp: 30, monthlyPrice: 39, contractRef: '4G-VEL-001', publicIp: '212.83.176.10' },
      // Saint-Cloud — Résidence Parc
      { siteCode: 'STC-01', role: 'PRIMARY', provider: 'Orange Business Services', type: 'FTTH', bandwidthDown: 1000, bandwidthUp: 300, monthlyPrice: 45, contractRef: 'FTTH-STC-001', publicIp: '193.252.122.104' },
      { siteCode: 'STC-01', role: 'BACKUP', provider: 'Bouygues Telecom Entreprises', type: '4G', bandwidthDown: 100, bandwidthUp: 20, monthlyPrice: 29, contractRef: '4G-STC-001', publicIp: '194.158.122.13' },
      // Massy — Pôle Atlantis
      { siteCode: 'MAS-01', role: 'PRIMARY', provider: 'Free Pro', type: 'FIBER', bandwidthDown: 1000, bandwidthUp: 600, monthlyPrice: 69, contractRef: 'FTTH-MAS-001', publicIp: '78.193.10.42' },
      { siteCode: 'MAS-01', role: 'BACKUP', provider: 'Convergence', type: '4G', bandwidthDown: 100, bandwidthUp: 20, monthlyPrice: 29, contractRef: '4G-MAS-001', publicIp: '212.83.176.11' },
      // Boulogne — Showroom Marcel (petit site, 5G seule)
      { siteCode: 'BOU-01', role: 'PRIMARY', provider: 'Bouygues Telecom Entreprises', type: '5G', bandwidthDown: 300, bandwidthUp: 50, monthlyPrice: 79, contractRef: '5G-BOU-001', publicIp: '194.158.122.14' },
      // Lyon (si présent) — Presqu'île
      { siteCode: 'LYO-01', role: 'PRIMARY', provider: 'SFR Business', type: 'FIBER', bandwidthDown: 1000, bandwidthUp: 300, monthlyPrice: 780, contractRef: 'FTTH-LYO-001', publicIp: '80.231.84.43' },
      { siteCode: 'LYO-01', role: 'BACKUP', provider: 'Orange Business Services', type: '4G', bandwidthDown: 150, bandwidthUp: 30, monthlyPrice: 35, contractRef: '4G-LYO-001', publicIp: '193.252.122.105' },
      // Marseille (si présent) — Joliette
      { siteCode: 'MRS-01', role: 'PRIMARY', provider: 'Orange Business Services', type: 'FIBER', bandwidthDown: 500, bandwidthUp: 200, monthlyPrice: 640, contractRef: 'FTTH-MRS-001', publicIp: '193.252.122.106' },
    ];

    let count = 0;
    for (const d of data) {
      const site = sites.find((s) => s.code === d.siteCode);
      if (!site) continue;

      const existing = await this.prisma.connectivityLink.findFirst({
        where: { tenantId, siteId: site.id, role: d.role, provider: d.provider },
      });
      if (existing) continue;

      // Wire the terminating equipment on PRIMARY links only (see map above).
      let assetId: string | null = null;
      if (d.role === 'PRIMARY') {
        const serial = primaryAssetBySite[d.siteCode];
        if (serial) {
          const terminating = assets.find((a) => a.serialNumber === serial && a.siteId === site.id);
          if (terminating) assetId = terminating.id;
        }
      }

      const link = await this.prisma.connectivityLink.create({
        data: {
          tenantId,
          siteId: site.id,
          role: d.role,
          provider: d.provider,
          type: d.type,
          bandwidthDown: d.bandwidthDown,
          bandwidthUp: d.bandwidthUp,
          publicIp: d.publicIp ?? null,
          monthlyPrice: d.monthlyPrice as any,
          currency: 'EUR',
          contractRef: d.contractRef,
          assetId,
        },
      });
      created.push(link);
      count++;
    }

    this.logger.log(`ConnectivityLinks seeded (${count} rows)`);
    return created;
  }

  /**
   * Seed SD-WAN configs + attached firewalls for the demo sites (phase 6.6 —
   * replaces the legacy Site.connectivity.sdwan JSON block).
   */
  private async createSdwanConfigsForDemo(tenantId: string, sites: any[], assets: any[]) {
    const plans: Array<{
      siteCode: string;
      provider: string;
      firewalls: Array<{ serial: string; role: 'active' | 'passive' | 'peer' }>;
      notes?: string;
    }> = [
      {
        siteCode: 'DEF-01',
        provider: 'Fortinet France',
        firewalls: [
          { serial: 'FGT100F-DEF-001', role: 'active' },
          { serial: 'FGT100F-DEF-002', role: 'passive' },
        ],
        notes: 'HA actif/passif — site siège',
      },
      {
        siteCode: 'SAC-01',
        provider: 'Fortinet France',
        firewalls: [{ serial: 'FGT80F-SAC-001', role: 'active' }],
        notes: 'Fortinet autonome',
      },
      {
        siteCode: 'VEL-01',
        provider: 'Fortinet France',
        firewalls: [{ serial: 'FGT80F-VEL-001', role: 'active' }],
      },
      {
        siteCode: 'STC-01',
        provider: 'Fortinet France',
        firewalls: [{ serial: 'FGT60F-STC-001', role: 'active' }],
      },
      {
        siteCode: 'MAS-01',
        provider: 'Fortinet France',
        firewalls: [{ serial: 'FGT60F-MAS-001', role: 'active' }],
      },
    ];

    let configCount = 0;
    let firewallCount = 0;
    for (const plan of plans) {
      const site = sites.find((s) => s.code === plan.siteCode);
      if (!site) continue;

      const config = await this.prisma.sdwanConfig.upsert({
        where: { siteId: site.id },
        create: {
          tenantId,
          siteId: site.id,
          enabled: true,
          provider: plan.provider,
          notes: plan.notes ?? null,
        },
        update: {
          provider: plan.provider,
          notes: plan.notes ?? null,
        },
      });
      configCount++;

      for (const fw of plan.firewalls) {
        const asset = assets.find((a) => a.serialNumber === fw.serial && a.siteId === site.id);
        if (!asset) continue;
        await this.prisma.sdwanFirewall.upsert({
          where: {
            sdwanConfigId_assetId: { sdwanConfigId: config.id, assetId: asset.id },
          },
          create: { sdwanConfigId: config.id, assetId: asset.id, role: fw.role },
          update: { role: fw.role },
        });
        firewallCount++;
      }
    }
    this.logger.log(`SD-WAN configs seeded (${configCount} configs, ${firewallCount} firewalls)`);
  }

  /**
   * A handful of unread in-app notifications so the bell is non-empty on first login.
   */
  private async createDemoUserNotifications(
    tenantId: string,
    users: any[],
    tasks: any[],
    sites: any[],
  ) {
    const manager = users.find((u) => u.email === 'manager@demo.fr');
    const tech = users.find((u) => u.email === 'technicien@demo.fr');
    const defense = sites.find((s) => s.code === 'DEF-01');
    const firstTask = tasks[0];

    const notifs: Array<any> = [];
    if (manager) {
      notifs.push({
        tenantId,
        userId: manager.id,
        type: 'TASK_ASSIGNED',
        title: 'Nouvelle tâche assignée',
        body: firstTask ? `Tâche « ${firstTask.title} » vous a été assignée` : 'Une nouvelle tâche vous attend',
      });
      notifs.push({
        tenantId,
        userId: manager.id,
        type: 'SITE_HEALTH_CHANGED',
        title: 'Santé de site dégradée',
        body: defense ? `Le site ${defense.name} est passé en WARNING` : 'Un site a changé d’état',
      });
    }
    if (tech) {
      notifs.push({
        tenantId,
        userId: tech.id,
        type: 'WARRANTY_EXPIRING',
        title: 'Garantie bientôt expirée',
        body: 'Un équipement a sa garantie qui expire sous 30 jours',
      });
    }

    for (const n of notifs) {
      // No unique key → idempotency by (userId, type, title)
      const existing = await this.prisma.userNotification.findFirst({
        where: { userId: n.userId, type: n.type, title: n.title },
      });
      if (!existing) {
        await this.prisma.userNotification.create({ data: n });
      }
    }

    this.logger.log(`UserNotifications seeded: ${notifs.length}`);
  }

  /**
   * A handful of AuditLog entries so the super-admin viewer has content on day one.
   * Keep it simple: just record the fact that the seed ran.
   */
  private async seedDemoAuditLogEntries(
    tenantId: string,
    users: any[],
    sites: any[],
    assets: any[],
  ) {
    const admin = users.find((u) => u.isSuperAdmin) || users[0];
    const firstSite = sites[0];
    const firstAsset = assets[0];

    const entries = [
      {
        tenantId,
        userId: admin.id,
        action: 'CREATE',
        entityType: 'site',
        entityId: firstSite?.id || null,
        changes: { after: { code: firstSite?.code, name: firstSite?.name } },
      },
      firstAsset
        ? {
            tenantId,
            userId: admin.id,
            action: 'CREATE',
            entityType: 'asset',
            entityId: firstAsset.id,
            changes: { after: { name: firstAsset.name, type: firstAsset.type } },
          }
        : null,
    ].filter(Boolean) as any[];

    // Idempotency: only seed if the table is empty for this tenant
    const existing = await this.prisma.auditLog.count({ where: { tenantId } });
    if (existing > 0) return;

    for (const e of entries) {
      await this.prisma.auditLog.create({ data: e });
    }

    this.logger.log(`AuditLog entries seeded: ${entries.length}`);
  }

  /**
   * Apply a custom appearance on technicien@demo.fr so the tenant/user override flow
   * is observable as soon as the demo is loaded.
   */
  private async applyTechnicianCustomAppearance(tenantId: string) {
    const tech = await this.prisma.user.findFirst({
      where: { tenantId, email: 'technicien@demo.fr' },
    });
    if (!tech) return;

    await this.prisma.user.update({
      where: { id: tech.id },
      data: {
        appearancePreference: { theme: 'dark', density: 'compact' } as any,
        appearanceSource: 'custom',
      },
    });
    this.logger.log('Technicien demo user: custom appearance applied (dark + compact)');
  }

  /**
   * ADR-014 — pre-enable RFC1918 monitoring for the on-prem pilot tenant.
   * Loopback (127/8, ::1) and link-local (169.254/16) remain blocked by
   * target-validator regardless of this flag.
   */
  private async enableInternalMonitorTargets(tenantId: string) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { allowInternalNetworkTargets: true },
    });
    this.logger.log('Tenant: allowInternalNetworkTargets = true (pilot LAN monitors)');
  }

  /**
   * ADR-014 — three demo monitor checks so the pilot has visible data
   * within the first scheduler tick (≤ 30s):
   *  - Site DEF-01 → ICMP ping 1.1.1.1 (Cloudflare DNS, public, always UP).
   *  - Site DEF-01 PRIMARY link → HTTP GET https://example.com/ (RFC2606,
   *    always 200, perfect smoke target).
   *  - Site SAC-01 → TCP github.com:443 (validates HTTPS reachability).
   */
  private async createMonitorChecksForDemo(
    tenantId: string,
    sites: any[],
    links: any[],
  ) {
    const def = sites.find((s) => s.code === 'DEF-01');
    const sac = sites.find((s) => s.code === 'SAC-01');
    const defPrimary = def
      ? links.find((l) => l.siteId === def.id && l.role === 'PRIMARY')
      : undefined;

    const seeds: Array<any> = [];
    if (def) {
      seeds.push({
        tenantId,
        siteId: def.id,
        kind: 'ICMP',
        target: '1.1.1.1',
        intervalSec: 300,
        enabled: true,
        nextCheckAt: new Date(),
      });
    }
    if (defPrimary) {
      seeds.push({
        tenantId,
        linkId: defPrimary.id,
        kind: 'HTTP',
        target: 'https://example.com/',
        intervalSec: 300,
        enabled: true,
        nextCheckAt: new Date(),
      });
    }
    if (sac) {
      seeds.push({
        tenantId,
        siteId: sac.id,
        kind: 'TCP',
        target: 'github.com',
        targetPort: 443,
        intervalSec: 300,
        enabled: true,
        nextCheckAt: new Date(),
      });
    }

    let httpConfigsCreated = 0;
    for (const data of seeds) {
      const check = await this.prisma.monitorCheck.create({ data });
      if (data.kind === 'HTTP') {
        await this.prisma.monitorHttpConfig.create({
          data: {
            checkId: check.id,
            method: 'GET',
            expectedStatus: 200,
            followRedirects: true,
            timeoutMs: 5000,
          },
        });
        httpConfigsCreated++;
      }
    }
    this.logger.log(
      `MonitorChecks seeded: ${seeds.length} (incl. ${httpConfigsCreated} HTTP configs)`,
    );
  }
}
