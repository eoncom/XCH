/**
 * Données de test pour E2E
 *
 * Fournit des données réalistes pour créer/modifier des entités
 */

export const TEST_DATA = {
  // Sites de test
  sites: {
    paris: {
      name: 'Site Test Paris E2E',
      address: '1 Rue de Rivoli, 75001 Paris',
      latitude: 48.8566,
      longitude: 2.3522,
      status: 'ACTIVE' as const,
    },
    lyon: {
      name: 'Site Test Lyon E2E',
      address: '1 Place Bellecour, 69002 Lyon',
      latitude: 45.7579,
      longitude: 4.8320,
      status: 'ACTIVE' as const,
    },
  },

  // Assets de test
  assets: {
    printer: {
      type: 'PRINTER' as const,
      brand: 'HP',
      model: 'LaserJet Pro M404dn',
      serialNumber: `TEST-PRINTER-${Date.now()}`,
      status: 'IN_SERVICE' as const,
    },
    ipad: {
      type: 'IPAD' as const,
      brand: 'Apple',
      model: 'iPad Pro 12.9"',
      serialNumber: `TEST-IPAD-${Date.now()}`,
      status: 'IN_SERVICE' as const,
    },
    switch: {
      type: 'SWITCH' as const,
      brand: 'Cisco',
      model: 'Catalyst 2960-X',
      serialNumber: `TEST-SWITCH-${Date.now()}`,
      status: 'IN_SERVICE' as const,
    },
  },

  // Tasks de test
  tasks: {
    installation: {
      title: 'Test - Installation équipement E2E',
      description: 'Tâche de test pour E2E Playwright',
      status: 'TODO' as const,
      priority: 'HIGH' as const,
    },
    maintenance: {
      title: 'Test - Maintenance préventive E2E',
      description: 'Vérification mensuelle des équipements',
      status: 'IN_PROGRESS' as const,
      priority: 'MEDIUM' as const,
    },
    completed: {
      title: 'Test - Tâche terminée E2E',
      description: 'Exemple de tâche déjà effectuée',
      status: 'DONE' as const,
      priority: 'LOW' as const,
    },
  },

  // Racks de test
  racks: {
    small: {
      name: 'Test Rack 4U E2E',
      heightU: 4,
      status: 'IN_SERVICE' as const,
      manufacturer: 'APC',
      model: 'NetShelter SX 4U',
    },
    standard: {
      name: 'Test Rack 42U E2E',
      heightU: 42,
      status: 'IN_SERVICE' as const,
      manufacturer: 'APC',
      model: 'NetShelter SX 42U',
    },
  },

  // Users de test
  users: {
    newTechnicien: {
      name: 'Technicien Test E2E',
      email: `tech-e2e-${Date.now()}@xch.local`,
      password: 'TechE2E123!',
      role: 'TECHNICIEN' as const,
    },
    newViewer: {
      name: 'Viewer Test E2E',
      email: `viewer-e2e-${Date.now()}@xch.local`,
      password: 'ViewerE2E123!',
      role: 'VIEWER' as const,
    },
  },
};

/**
 * Génère des données uniques pour éviter les collisions
 */
export function generateUniqueData<T extends Record<string, any>>(
  baseData: T
): T {
  const timestamp = Date.now();
  const result = { ...baseData };

  // Ajouter timestamp aux champs texte
  if ('name' in result && typeof result.name === 'string') {
    result.name = `${result.name} ${timestamp}`;
  }
  if ('title' in result && typeof result.title === 'string') {
    result.title = `${result.title} ${timestamp}`;
  }
  if ('serialNumber' in result && typeof result.serialNumber === 'string') {
    result.serialNumber = `${result.serialNumber}-${timestamp}`;
  }

  return result;
}
