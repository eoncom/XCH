import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, UserRole, SiteStatus, HealthStatus, AssetType, AssetStatus, RackType, RackStatus, TaskStatus, TaskPriority, ContactCategory } from '@prisma/client';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async loadDemo(tenantId: string) {
    this.logger.log(`Loading demo data for tenant ${tenantId}`);

    // Update tenant with realistic org name and config
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: 'EONCOM - Délégation Île-de-France',
        config: {
          domain: 'eoncom.io',
          timezone: 'Europe/Paris',
          language: 'Français',
        },
      },
    });

    const sites = await this.createSites(tenantId);
    const users = await this.createUsers(tenantId);
    const racks = await this.createRacks(tenantId, sites);
    const assets = await this.createAssets(tenantId, sites, racks);
    const tasks = await this.createTasks(tenantId, sites, users, assets);
    const contactTypes = await this.createContactTypes(tenantId);
    const contacts = await this.createContacts(tenantId, contactTypes);

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
      await this.prisma.externalRef.deleteMany({ where: { tenantId } });
      await this.prisma.task.deleteMany({ where: { tenantId } });
      await this.prisma.asset.deleteMany({ where: { tenantId } });
      await this.prisma.rack.deleteMany({ where: { tenantId } });
      await this.prisma.site.deleteMany({ where: { tenantId } });
      await this.prisma.contact.deleteMany({ where: { tenantId } });
      await this.prisma.contactType.deleteMany({ where: { tenantId } });
      await this.prisma.integrationMapping.deleteMany({ where: { tenantId } });
      await this.prisma.userSiteAccess.deleteMany({ where: { tenantId } });
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
  // SITES - 6 chantiers réalistes (3 grands, 2 moyens, 1 petit)
  // ============================================================================

  private async createSites(tenantId: string) {
    const sitesData = [
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
          { name: 'Pierre Durand', phone: '+33 1 41 26 00 00', email: 'p.durand@alto.fr', role: 'Responsable IT chantier', isPrimary: true },
          { name: 'Marie Lefebvre', phone: '+33 6 12 34 56 78', email: 'm.lefebvre@alto.fr', role: 'Chef de chantier' },
        ],
        connectivity: {
          primary: { type: 'Fibre optique dédiée', provider: 'Orange Business', ref: 'FTTO-DEF-001' },
          backup: { type: 'SD-WAN 4G/5G', provider: 'Fortinet', ref: 'SDWAN-DEF-001' },
          cutProcedure: 'Contacter NOC EONCOM au 01 XX XX XX XX puis basculer SD-WAN',
        },
        notes: 'Grand chantier Tour Alto - 8 étages, salle IT au RDC et étage 4. Accès badge NEXITY + escorte zone serveur.',
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
        connectivity: {
          primary: { type: 'Fibre optique', provider: 'SFR Business', ref: 'FTTH-SAC-001' },
          backup: { type: 'SD-WAN 5G', provider: 'Fortinet', ref: 'SDWAN-SAC-001' },
        },
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
        connectivity: {
          primary: { type: 'Fibre optique', provider: 'Bouygues Telecom', ref: 'FTTH-VEL-001' },
          backup: { type: 'SD-WAN 4G', provider: 'Fortinet', ref: 'SDWAN-VEL-001' },
        },
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
          { name: 'François Dubois', phone: '+33 1 46 02 00 00', email: 'f.dubois@residenceparc.fr', role: 'Responsable chantier', isPrimary: true },
        ],
        connectivity: {
          primary: { type: 'FTTH', provider: 'Orange', ref: 'FTTH-STC-001' },
          backup: { type: '4G Backup', provider: 'Bouygues', ref: '4G-STC-001' },
        },
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
        connectivity: {
          primary: { type: 'Fibre optique', provider: 'Free Pro', ref: 'FTTH-MAS-001' },
          backup: { type: 'SD-WAN 4G', provider: 'Fortinet', ref: 'SDWAN-MAS-001' },
        },
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
        connectivity: {
          primary: { type: 'Box 5G', provider: 'Bouygues', ref: '5G-BOU-001' },
        },
        notes: 'Petit showroom temporaire - installation prévue semaine prochaine. Pas de salle serveur, équipement sous bureau.',
      },
    ];

    const sites = [];
    for (const s of sitesData) {
      const site = await this.prisma.site.upsert({
        where: { id: s.id },
        update: {},
        create: {
          ...s,
          tenantId,
        },
      });
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
        id: `demo-user-manager-${tenantId}`,
        email: 'manager@demo.fr',
        name: 'Sophie Martin',
        role: UserRole.MANAGER,
        phone: '+33 6 12 34 56 78',
      },
      {
        id: `demo-user-tech1-${tenantId}`,
        email: 'technicien@demo.fr',
        name: 'Marc Leroy',
        role: UserRole.TECHNICIEN,
        phone: '+33 6 98 76 54 32',
      },
      {
        id: `demo-user-tech2-${tenantId}`,
        email: 'technicien2@demo.fr',
        name: 'Karim Benali',
        role: UserRole.TECHNICIEN,
        phone: '+33 6 55 44 33 22',
      },
      {
        id: `demo-user-viewer-${tenantId}`,
        email: 'viewer@demo.fr',
        name: 'Nathalie Rousseau',
        role: UserRole.VIEWER,
        phone: '+33 6 11 22 33 44',
      },
    ];

    const users = [];
    for (const u of usersData) {
      const user = await this.prisma.user.upsert({
        where: { id: u.id },
        update: {},
        create: {
          ...u,
          tenantId,
          passwordHash: '$2b$10$dummyhashfordemopurposes',
        },
      });
      users.push(user);
    }

    return users;
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
      { siteId: defense.id, rackId: defR1.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.FIREWALL, manufacturer: 'Fortinet', model: 'FortiGate 100F', serialNumber: 'FGT100F-DEF-001', status: AssetStatus.IN_SERVICE, notes: 'SD-WAN principal - HA Active', networkInfo: { ip: '10.1.0.1', hostname: 'FW-DEF-01', vlan: '1' } },
      { siteId: defense.id, rackId: defR1.id, rackPositionU: 2, rackHeightU: 1, type: AssetType.FIREWALL, manufacturer: 'Fortinet', model: 'FortiGate 100F', serialNumber: 'FGT100F-DEF-002', status: AssetStatus.IN_SERVICE, notes: 'SD-WAN secondaire - HA Passive', networkInfo: { ip: '10.1.0.2', hostname: 'FW-DEF-02', vlan: '1' } },
      // Switches Cisco
      { siteId: defense.id, rackId: defR1.id, rackPositionU: 5, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9300-48P', serialNumber: 'C9300-DEF-001', status: AssetStatus.IN_SERVICE, notes: 'Switch cœur réseau - Stack Master', networkInfo: { ip: '10.1.1.1', hostname: 'SW-DEF-CORE-01', vlan: '1' } },
      { siteId: defense.id, rackId: defR1.id, rackPositionU: 6, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9300-48P', serialNumber: 'C9300-DEF-002', status: AssetStatus.IN_SERVICE, notes: 'Switch cœur réseau - Stack Member', networkInfo: { ip: '10.1.1.2', hostname: 'SW-DEF-CORE-02', vlan: '1' } },
      { siteId: defense.id, rackId: defR2.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-48P', serialNumber: 'C9200-DEF-003', status: AssetStatus.IN_SERVICE, notes: 'Switch distribution étages 1-2', networkInfo: { ip: '10.1.2.1', hostname: 'SW-DEF-DIST-01' } },
      { siteId: defense.id, rackId: defR2.id, rackPositionU: 2, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-48P', serialNumber: 'C9200-DEF-004', status: AssetStatus.IN_SERVICE, notes: 'Switch distribution étages 3-4', networkInfo: { ip: '10.1.2.2', hostname: 'SW-DEF-DIST-02' } },
      { siteId: defense.id, rackId: defR3.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-48P', serialNumber: 'C9200-DEF-005', status: AssetStatus.IN_SERVICE, notes: 'Switch distribution étages 5-6', networkInfo: { ip: '10.1.3.1', hostname: 'SW-DEF-DIST-03' } },
      { siteId: defense.id, rackId: defR3.id, rackPositionU: 2, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-24P', serialNumber: 'C9200-DEF-006', status: AssetStatus.IN_SERVICE, notes: 'Switch distribution étages 7-8', networkInfo: { ip: '10.1.3.2', hostname: 'SW-DEF-DIST-04' } },
      { siteId: defense.id, rackId: defLT1.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-24P', serialNumber: 'C9200-DEF-007', status: AssetStatus.IN_SERVICE, notes: 'Switch local technique étage 4' },
      // Patch Panels
      { siteId: defense.id, rackId: defR1.id, rackPositionU: 8, rackHeightU: 1, type: AssetType.PATCH_PANEL, manufacturer: 'Legrand', model: 'Patch Panel 48 ports Cat6a', serialNumber: 'PP-DEF-001', status: AssetStatus.IN_SERVICE, notes: 'Panneau brassage cœur' },
      { siteId: defense.id, rackId: defR2.id, rackPositionU: 4, rackHeightU: 1, type: AssetType.PATCH_PANEL, manufacturer: 'Legrand', model: 'Patch Panel 48 ports Cat6a', serialNumber: 'PP-DEF-002', status: AssetStatus.IN_SERVICE, notes: 'Panneau brassage distribution 1' },
      { siteId: defense.id, rackId: defR3.id, rackPositionU: 4, rackHeightU: 1, type: AssetType.PATCH_PANEL, manufacturer: 'Legrand', model: 'Patch Panel 48 ports Cat6a', serialNumber: 'PP-DEF-003', status: AssetStatus.IN_SERVICE, notes: 'Panneau brassage distribution 2' },
      // PDUs
      { siteId: defense.id, rackId: defR1.id, rackPositionU: 40, rackHeightU: 2, type: AssetType.PDU, manufacturer: 'APC', model: 'Rack PDU 2G Metered', serialNumber: 'PDU-DEF-001', status: AssetStatus.IN_SERVICE },
      { siteId: defense.id, rackId: defR2.id, rackPositionU: 22, rackHeightU: 2, type: AssetType.PDU, manufacturer: 'APC', model: 'Rack PDU 2G Metered', serialNumber: 'PDU-DEF-002', status: AssetStatus.IN_SERVICE },
      // Access Points WiFi - Cisco Meraki
      { siteId: defense.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-DEF-001', status: AssetStatus.IN_SERVICE, locationText: 'Étage 1 - Open Space', notes: 'AP WiFi 6', networkInfo: { ip: '10.1.10.11', hostname: 'AP-DEF-E1-01' } },
      { siteId: defense.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-DEF-002', status: AssetStatus.IN_SERVICE, locationText: 'Étage 2 - Open Space', networkInfo: { ip: '10.1.10.12', hostname: 'AP-DEF-E2-01' } },
      { siteId: defense.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-DEF-003', status: AssetStatus.IN_SERVICE, locationText: 'Étage 3 - Salle réunion', networkInfo: { ip: '10.1.10.13', hostname: 'AP-DEF-E3-01' } },
      { siteId: defense.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-DEF-004', status: AssetStatus.IN_SERVICE, locationText: 'Étage 4 - Direction', networkInfo: { ip: '10.1.10.14', hostname: 'AP-DEF-E4-01' } },
      { siteId: defense.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-DEF-005', status: AssetStatus.IN_SERVICE, locationText: 'Étage 5 - Open Space', networkInfo: { ip: '10.1.10.15', hostname: 'AP-DEF-E5-01' } },
      { siteId: defense.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-DEF-006', status: AssetStatus.IN_SERVICE, locationText: 'Étage 6 - Open Space', networkInfo: { ip: '10.1.10.16', hostname: 'AP-DEF-E6-01' } },
      { siteId: defense.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-DEF-007', status: AssetStatus.IN_SERVICE, locationText: 'Étage 7 - Salle formation', networkInfo: { ip: '10.1.10.17', hostname: 'AP-DEF-E7-01' } },
      { siteId: defense.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-DEF-008', status: AssetStatus.IN_SERVICE, locationText: 'Étage 8 - Présidence', networkInfo: { ip: '10.1.10.18', hostname: 'AP-DEF-E8-01' } },
      // Imprimantes
      { siteId: defense.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'LaserJet Enterprise M507dn', serialNumber: 'HP-DEF-IMP-001', status: AssetStatus.IN_SERVICE, locationText: 'Étage 1 - Espace copie', networkInfo: { ip: '10.1.20.11', hostname: 'IMP-DEF-E1' } },
      { siteId: defense.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'LaserJet Enterprise M507dn', serialNumber: 'HP-DEF-IMP-002', status: AssetStatus.IN_SERVICE, locationText: 'Étage 3 - Espace copie', networkInfo: { ip: '10.1.20.13', hostname: 'IMP-DEF-E3' } },
      { siteId: defense.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'Color LaserJet Pro M479fdw', serialNumber: 'HP-DEF-IMP-003', status: AssetStatus.IN_SERVICE, locationText: 'Étage 5 - Espace copie', networkInfo: { ip: '10.1.20.15', hostname: 'IMP-DEF-E5' } },
      { siteId: defense.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'Color LaserJet Pro M479fdw', serialNumber: 'HP-DEF-IMP-004', status: AssetStatus.IN_SERVICE, locationText: 'Étage 8 - Direction', networkInfo: { ip: '10.1.20.18', hostname: 'IMP-DEF-E8' } },
      // Teams Room Yealink
      { siteId: defense.id, type: AssetType.TEAMS_ROOM, manufacturer: 'Yealink', model: 'MeetingBoard 65', serialNumber: 'YLK-DEF-TR-001', status: AssetStatus.IN_SERVICE, locationText: 'Étage 4 - Salle Haussmann (12 places)', notes: 'Teams Room complète avec caméra UVC84 et micro VCM38' },
      { siteId: defense.id, type: AssetType.TEAMS_ROOM, manufacturer: 'Yealink', model: 'MeetingBar A30', serialNumber: 'YLK-DEF-TR-002', status: AssetStatus.IN_SERVICE, locationText: 'Étage 4 - Salle Rivoli (6 places)', notes: 'Teams Room pour moyenne salle' },
      { siteId: defense.id, type: AssetType.TEAMS_ROOM, manufacturer: 'Yealink', model: 'MeetingBar A20', serialNumber: 'YLK-DEF-TR-003', status: AssetStatus.IN_SERVICE, locationText: 'Étage 8 - Salle DG (4 places)', notes: 'Teams Room compacte direction' },
      // Caméras
      { siteId: defense.id, type: AssetType.CAMERA, manufacturer: 'Axis', model: 'P3245-V', serialNumber: 'AXIS-DEF-CAM-001', status: AssetStatus.IN_SERVICE, locationText: 'Hall d\'entrée RDC', networkInfo: { ip: '10.1.30.1', hostname: 'CAM-DEF-HALL' } },
      { siteId: defense.id, type: AssetType.CAMERA, manufacturer: 'Axis', model: 'P3245-V', serialNumber: 'AXIS-DEF-CAM-002', status: AssetStatus.IN_SERVICE, locationText: 'Salle serveur RDC', networkInfo: { ip: '10.1.30.2', hostname: 'CAM-DEF-SRV' } },

      // =====================================================================
      // SACLAY - GRAND CHANTIER
      // =====================================================================
      // SD-WAN Fortinet
      { siteId: saclay.id, rackId: sacR1.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.FIREWALL, manufacturer: 'Fortinet', model: 'FortiGate 80F', serialNumber: 'FGT80F-SAC-001', status: AssetStatus.IN_SERVICE, notes: 'SD-WAN campus', networkInfo: { ip: '10.2.0.1', hostname: 'FW-SAC-01' } },
      // Switches
      { siteId: saclay.id, rackId: sacR1.id, rackPositionU: 3, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9300-48P', serialNumber: 'C9300-SAC-001', status: AssetStatus.IN_SERVICE, notes: 'Switch cœur campus', networkInfo: { ip: '10.2.1.1', hostname: 'SW-SAC-CORE-01' } },
      { siteId: saclay.id, rackId: sacR2.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-48P', serialNumber: 'C9200-SAC-002', status: AssetStatus.IN_SERVICE, notes: 'Switch distribution bâtiment B' },
      { siteId: saclay.id, rackId: sacR2.id, rackPositionU: 2, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-48P', serialNumber: 'C9200-SAC-003', status: AssetStatus.IN_SERVICE, notes: 'Switch distribution bâtiment C' },
      { siteId: saclay.id, rackId: sacLT1.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-24P', serialNumber: 'C9200-SAC-004', status: AssetStatus.IN_SERVICE, notes: 'Switch local technique bat B' },
      // Patch Panels
      { siteId: saclay.id, rackId: sacR1.id, rackPositionU: 5, rackHeightU: 1, type: AssetType.PATCH_PANEL, manufacturer: 'Legrand', model: 'Patch Panel 48 ports Cat6a', serialNumber: 'PP-SAC-001', status: AssetStatus.IN_SERVICE },
      // AP WiFi
      { siteId: saclay.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR56', serialNumber: 'MR56-SAC-001', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment A - Amphithéâtre 1', notes: 'AP haute densité WiFi 6E', networkInfo: { ip: '10.2.10.1', hostname: 'AP-SAC-A-AMPHI1' } },
      { siteId: saclay.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR56', serialNumber: 'MR56-SAC-002', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment A - Amphithéâtre 2', networkInfo: { ip: '10.2.10.2', hostname: 'AP-SAC-A-AMPHI2' } },
      { siteId: saclay.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-SAC-003', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment B - RDC Accueil', networkInfo: { ip: '10.2.10.3', hostname: 'AP-SAC-B-RDC' } },
      { siteId: saclay.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-SAC-004', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment B - Étage 1', networkInfo: { ip: '10.2.10.4', hostname: 'AP-SAC-B-E1' } },
      { siteId: saclay.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-SAC-005', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment C - Cafétéria', networkInfo: { ip: '10.2.10.5', hostname: 'AP-SAC-C-CAF' } },
      { siteId: saclay.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-SAC-006', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment C - Bibliothèque', networkInfo: { ip: '10.2.10.6', hostname: 'AP-SAC-C-BIB' } },
      // Imprimantes
      { siteId: saclay.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'LaserJet Enterprise M507dn', serialNumber: 'HP-SAC-IMP-001', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment A - Secrétariat' },
      { siteId: saclay.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'Color LaserJet Pro M479fdw', serialNumber: 'HP-SAC-IMP-002', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment B - Salle profs' },
      { siteId: saclay.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'LaserJet Enterprise M507dn', serialNumber: 'HP-SAC-IMP-003', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment C - Administration' },
      // Teams Room
      { siteId: saclay.id, type: AssetType.TEAMS_ROOM, manufacturer: 'Yealink', model: 'MeetingBoard 65', serialNumber: 'YLK-SAC-TR-001', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment A - Salle Conseil', notes: 'Salle de conseil 20 places' },
      { siteId: saclay.id, type: AssetType.TEAMS_ROOM, manufacturer: 'Yealink', model: 'MeetingBar A30', serialNumber: 'YLK-SAC-TR-002', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment B - Salle réunion 1' },

      // =====================================================================
      // VÉLIZY - GRAND CHANTIER
      // =====================================================================
      // SD-WAN Fortinet
      { siteId: velizy.id, rackId: velR1.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.FIREWALL, manufacturer: 'Fortinet', model: 'FortiGate 80F', serialNumber: 'FGT80F-VEL-001', status: AssetStatus.IN_SERVICE, notes: 'SD-WAN principal', networkInfo: { ip: '10.3.0.1', hostname: 'FW-VEL-01' } },
      // Switches
      { siteId: velizy.id, rackId: velR1.id, rackPositionU: 3, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9300-48P', serialNumber: 'C9300-VEL-001', status: AssetStatus.IN_SERVICE, notes: 'Switch cœur', networkInfo: { ip: '10.3.1.1', hostname: 'SW-VEL-CORE-01' } },
      { siteId: velizy.id, rackId: velR1.id, rackPositionU: 4, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-48P', serialNumber: 'C9200-VEL-002', status: AssetStatus.IN_SERVICE, notes: 'Switch distribution étages 1-3' },
      { siteId: velizy.id, rackId: velR2.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-48P', serialNumber: 'C9200-VEL-003', status: AssetStatus.IN_SERVICE, notes: 'Switch distribution étages 4-5' },
      // AP WiFi
      { siteId: velizy.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-VEL-001', status: AssetStatus.IN_SERVICE, locationText: 'Étage 1 - Open Space' },
      { siteId: velizy.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-VEL-002', status: AssetStatus.IN_SERVICE, locationText: 'Étage 2 - Open Space' },
      { siteId: velizy.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-VEL-003', status: AssetStatus.IN_SERVICE, locationText: 'Étage 3 - Salles réunion' },
      { siteId: velizy.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-VEL-004', status: AssetStatus.IN_SERVICE, locationText: 'Étage 4 - Open Space' },
      // Imprimantes
      { siteId: velizy.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'LaserJet Enterprise M507dn', serialNumber: 'HP-VEL-IMP-001', status: AssetStatus.IN_SERVICE, locationText: 'Étage 1 - Zone copie' },
      { siteId: velizy.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'Color LaserJet Pro M479fdw', serialNumber: 'HP-VEL-IMP-002', status: AssetStatus.IN_SERVICE, locationText: 'Étage 3 - Zone copie' },
      { siteId: velizy.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'LaserJet Enterprise M507dn', serialNumber: 'HP-VEL-IMP-003', status: AssetStatus.OUT_OF_SERVICE, locationText: 'Étage 5 - Zone copie', notes: 'En panne - ticket support HP ouvert' },
      // Teams Room
      { siteId: velizy.id, type: AssetType.TEAMS_ROOM, manufacturer: 'Yealink', model: 'MeetingBar A30', serialNumber: 'YLK-VEL-TR-001', status: AssetStatus.IN_SERVICE, locationText: 'Étage 2 - Salle Concorde (8 places)' },
      { siteId: velizy.id, type: AssetType.TEAMS_ROOM, manufacturer: 'Yealink', model: 'MeetingBar A20', serialNumber: 'YLK-VEL-TR-002', status: AssetStatus.IN_SERVICE, locationText: 'Étage 4 - Salle Opéra (4 places)' },

      // =====================================================================
      // SAINT-CLOUD - MOYEN CHANTIER
      // =====================================================================
      // SD-WAN
      { siteId: stcloud.id, rackId: stcR1.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.FIREWALL, manufacturer: 'Fortinet', model: 'FortiGate 60F', serialNumber: 'FGT60F-STC-001', status: AssetStatus.IN_SERVICE, notes: 'SD-WAN', networkInfo: { ip: '10.4.0.1', hostname: 'FW-STC-01' } },
      // Switches
      { siteId: stcloud.id, rackId: stcR1.id, rackPositionU: 3, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-48P', serialNumber: 'C9200-STC-001', status: AssetStatus.IN_SERVICE, notes: 'Switch principal' },
      { siteId: stcloud.id, rackId: stcR2.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-24P', serialNumber: 'C9200-STC-002', status: AssetStatus.IN_SERVICE, notes: 'Switch distribution' },
      // AP WiFi
      { siteId: stcloud.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-STC-001', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment A - RDC Hall' },
      { siteId: stcloud.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-STC-002', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment A - Étage 1' },
      { siteId: stcloud.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-STC-003', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment B - RDC' },
      { siteId: stcloud.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-STC-004', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment B - Étage 1' },
      // Imprimantes
      { siteId: stcloud.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'LaserJet Enterprise M507dn', serialNumber: 'HP-STC-IMP-001', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment A - RDC Accueil' },
      { siteId: stcloud.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'Color LaserJet Pro M479fdw', serialNumber: 'HP-STC-IMP-002', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment B - Étage 1 Bureau' },
      // Teams Room
      { siteId: stcloud.id, type: AssetType.TEAMS_ROOM, manufacturer: 'Yealink', model: 'MeetingBar A20', serialNumber: 'YLK-STC-TR-001', status: AssetStatus.IN_SERVICE, locationText: 'Bâtiment A - Salle réunion (6 places)' },

      // =====================================================================
      // MASSY - MOYEN CHANTIER
      // =====================================================================
      // SD-WAN
      { siteId: massy.id, rackId: masR1.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.FIREWALL, manufacturer: 'Fortinet', model: 'FortiGate 60F', serialNumber: 'FGT60F-MAS-001', status: AssetStatus.IN_SERVICE, notes: 'SD-WAN', networkInfo: { ip: '10.5.0.1', hostname: 'FW-MAS-01' } },
      // Switches
      { siteId: massy.id, rackId: masR1.id, rackPositionU: 3, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-48P', serialNumber: 'C9200-MAS-001', status: AssetStatus.IN_SERVICE, notes: 'Switch principal' },
      { siteId: massy.id, rackId: masR2.id, rackPositionU: 1, rackHeightU: 1, type: AssetType.SWITCH, manufacturer: 'Cisco', model: 'Catalyst 9200-24P', serialNumber: 'C9200-MAS-002', status: AssetStatus.IN_SERVICE, notes: 'Switch distribution WiFi' },
      // AP WiFi
      { siteId: massy.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-MAS-001', status: AssetStatus.IN_SERVICE, locationText: 'RDC - Zone commerciale' },
      { siteId: massy.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-MAS-002', status: AssetStatus.IN_SERVICE, locationText: 'Étage 1 - Bureaux' },
      { siteId: massy.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-MAS-003', status: AssetStatus.IN_SERVICE, locationText: 'Étage 2 - Open Space' },
      { siteId: massy.id, type: AssetType.WIFI_AP, manufacturer: 'Cisco Meraki', model: 'MR46', serialNumber: 'MR46-MAS-004', status: AssetStatus.IN_SERVICE, locationText: 'Étage 3 - Direction' },
      // Imprimantes
      { siteId: massy.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'LaserJet Enterprise M507dn', serialNumber: 'HP-MAS-IMP-001', status: AssetStatus.IN_SERVICE, locationText: 'Étage 1 - Zone copie' },
      { siteId: massy.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'Color LaserJet Pro M479fdw', serialNumber: 'HP-MAS-IMP-002', status: AssetStatus.IN_SERVICE, locationText: 'Étage 3 - Direction' },
      // Teams Room
      { siteId: massy.id, type: AssetType.TEAMS_ROOM, manufacturer: 'Yealink', model: 'MeetingBar A30', serialNumber: 'YLK-MAS-TR-001', status: AssetStatus.IN_SERVICE, locationText: 'Étage 2 - Salle réunion (8 places)' },

      // =====================================================================
      // BOULOGNE - PETIT CHANTIER (pas de baie, équipement minimal)
      // =====================================================================
      { siteId: boulogne.id, type: AssetType.ROUTER, manufacturer: 'Bouygues Telecom', model: 'Bbox 5G Pro', serialNumber: 'BBOX5G-BOU-001', status: AssetStatus.IN_SERVICE, locationText: 'Sous bureau accueil', notes: 'Box 5G principale - débit 300 Mbps' },
      { siteId: boulogne.id, type: AssetType.PRINTER, manufacturer: 'HP', model: 'LaserJet Pro M404dn', serialNumber: 'HP-BOU-IMP-001', status: AssetStatus.STOCK, locationText: 'Réserve', notes: 'Pas encore installée' },
    ];

    const assets = [];
    for (const a of assetsData) {
      const asset = await this.prisma.asset.create({
        data: {
          tenantId,
          ...a,
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

    const manager = users.find(u => u.role === UserRole.MANAGER);
    const tech1 = users.find(u => u.name === 'Marc Leroy');
    const tech2 = users.find(u => u.name === 'Karim Benali');

    const impVelHS = assets.find(a => a.serialNumber === 'HP-VEL-IMP-003');
    const impBouStock = assets.find(a => a.serialNumber === 'HP-BOU-IMP-001');

    const tasksData = [
      // Défense
      { siteId: defense.id, title: 'Remplacement switch étage 7', description: 'Le switch C9200-24P montre des erreurs CRC sur ports 1-8. Prévoir remplacement sous garantie Cisco TAC.', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, assignedTo: tech1?.id, createdBy: manager?.id || tech1?.id, dueDate: new Date(Date.now() + 3 * 24 * 3600000) },
      { siteId: defense.id, title: 'Mise à jour firmware FortiGate', description: 'Passer les 2 FortiGate 100F en FortiOS 7.4.3. Planifier fenêtre maintenance nuit.', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, assignedTo: tech1?.id, createdBy: manager?.id || tech1?.id, dueDate: new Date(Date.now() + 14 * 24 * 3600000) },
      { siteId: defense.id, title: 'Ajout AP WiFi étage 2 - zone meeting', description: 'Couverture WiFi insuffisante dans la nouvelle zone meeting étage 2. Commander et installer 1 MR46 supplémentaire.', status: TaskStatus.TODO, priority: TaskPriority.LOW, assignedTo: tech2?.id, createdBy: manager?.id || tech2?.id },
      // Saclay
      { siteId: saclay.id, title: 'Optimisation WiFi amphithéâtres', description: 'Ajuster les canaux et puissance des MR56 dans les amphithéâtres. Pic de charge pendant les cours (500 utilisateurs).', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, assignedTo: tech2?.id, createdBy: manager?.id || tech2?.id, dueDate: new Date(Date.now() + 5 * 24 * 3600000) },
      { siteId: saclay.id, title: 'Câblage réseau bâtiment C - étage 2', description: 'Tirer 24 prises RJ45 Cat6a pour le nouvel open space bâtiment C étage 2.', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, createdBy: manager?.id || tech1?.id, dueDate: new Date(Date.now() + 21 * 24 * 3600000) },
      // Vélizy
      { siteId: velizy.id, title: 'Réparation imprimante étage 5', description: 'Imprimante HP M507dn en panne. Ticket HP #INC-2024-4521 ouvert. Attente pièce de rechange.', status: TaskStatus.BLOCKED, priority: TaskPriority.MEDIUM, assignedTo: tech1?.id, createdBy: manager?.id || tech1?.id, assetId: impVelHS?.id },
      { siteId: velizy.id, title: 'Vérification climatisation salle serveur', description: 'Alerte température salle serveur. Climatisation en maintenance depuis 2 semaines. Vérifier état et planifier intervention Dalkia.', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT, assignedTo: tech1?.id, createdBy: manager?.id || tech1?.id, dueDate: new Date(Date.now() + 1 * 24 * 3600000) },
      // Saint-Cloud
      { siteId: stcloud.id, title: 'Test réseau bâtiment B', description: 'Valider le déploiement réseau complet bâtiment B : connectivité, WiFi, VLAN, QoS.', status: TaskStatus.TODO, priority: TaskPriority.HIGH, assignedTo: tech2?.id, createdBy: manager?.id || tech2?.id, dueDate: new Date(Date.now() + 7 * 24 * 3600000) },
      // Massy
      { siteId: massy.id, title: 'Configuration VLAN zone commerciale', description: 'Séparer le réseau zone commerciale (VLAN 100) du réseau bureaux (VLAN 200). Configurer inter-VLAN routing sur FortiGate.', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM, assignedTo: tech2?.id, createdBy: manager?.id || tech2?.id },
      // Boulogne
      { siteId: boulogne.id, title: 'Installation complète showroom', description: 'Installer la box 5G, configurer le WiFi, brancher l\'imprimante, tester la connectivité. Prévoir 1 journée sur site.', status: TaskStatus.TODO, priority: TaskPriority.HIGH, assignedTo: tech1?.id, createdBy: manager?.id || tech1?.id, assetId: impBouStock?.id, dueDate: new Date(Date.now() + 5 * 24 * 3600000) },
      // Tâches terminées
      { siteId: defense.id, title: 'Installation Teams Room salle Haussmann', description: 'Installation et configuration du MeetingBoard 65 Yealink dans la salle Haussmann étage 4.', status: TaskStatus.DONE, priority: TaskPriority.HIGH, assignedTo: tech1?.id, createdBy: manager?.id || tech1?.id, completedAt: new Date(Date.now() - 5 * 24 * 3600000) },
      { siteId: saclay.id, title: 'Déploiement AP WiFi bibliothèque', description: 'Installation du MR46 dans la bibliothèque bâtiment C. Configuration SSID et profil de sécurité.', status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, assignedTo: tech2?.id, createdBy: manager?.id || tech2?.id, completedAt: new Date(Date.now() - 3 * 24 * 3600000) },
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
      { name: 'SFR Business', typeId: telecom.id, email: 'pro@sfr.fr', phone: '1023', company: 'SFR', role: 'Opérateur backup', notes: 'Liaisons fibre Saclay' },
      { name: 'Fortinet France', typeId: securite.id, email: 'support-fr@fortinet.com', phone: '+33 1 72 52 40 00', company: 'Fortinet', role: 'Support SD-WAN & Sécurité', notes: 'Contrat FortiCare Premium sur tous les FortiGate. TAC 24/7.' },
      { name: 'Cisco TAC France', typeId: reseau.id, email: 'tac@cisco.com', phone: '+33 1 58 04 60 00', company: 'Cisco', role: 'Support réseau', notes: 'SmartNet sur switches Catalyst 9200/9300. RMA J+1.' },
      { name: 'Cisco Meraki Support', typeId: internet.id, email: 'support@meraki.com', phone: '+33 1 70 39 17 05', company: 'Cisco Meraki', role: 'Support WiFi Cloud', notes: 'Licence Enterprise sur tous les AP MR46/MR56' },
      { name: 'HP Support Pro', typeId: maintenance.id, email: 'support-fr@hp.com', phone: '01 57 32 32 32', company: 'HP Inc.', role: 'Support imprimantes', notes: 'Contrat Care Pack Next Business Day sur imprimantes Enterprise' },
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
}
