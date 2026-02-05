-- Script d'insertion policies Casbin RBAC
-- Date: 2026-02-05
-- Context: Refactoring Providers → Contacts + ContactTypes

-- Supprimer anciennes policies providers
DELETE FROM casbin_rule WHERE ptype = 'p' AND v1 = 'providers';

-- Supprimer anciennes policies non-ADMIN (au cas où)
DELETE FROM casbin_rule WHERE ptype = 'p' AND v0 IN ('MANAGER', 'TECHNICIEN', 'VIEWER');

-- Supprimer anciennes policies ADMIN contacts/contact-types (éviter doublons)
DELETE FROM casbin_rule WHERE ptype = 'p' AND v0 = 'ADMIN' AND v1 IN ('contacts', 'contact-types');

-- ADMIN policies contacts + contact-types (8 total)
INSERT INTO casbin_rule (ptype, v0, v1, v2, v3) VALUES
('p', 'ADMIN', 'contacts', 'create', '*'),
('p', 'ADMIN', 'contacts', 'read', '*'),
('p', 'ADMIN', 'contacts', 'update', '*'),
('p', 'ADMIN', 'contacts', 'delete', '*'),
('p', 'ADMIN', 'contact-types', 'create', '*'),
('p', 'ADMIN', 'contact-types', 'read', '*'),
('p', 'ADMIN', 'contact-types', 'update', '*'),
('p', 'ADMIN', 'contact-types', 'delete', '*');

-- MANAGER policies (14 total)
INSERT INTO casbin_rule (ptype, v0, v1, v2, v3) VALUES
('p', 'MANAGER', 'sites', 'read', '*'),
('p', 'MANAGER', 'assets', 'read', '*'),
('p', 'MANAGER', 'racks', 'read', '*'),
('p', 'MANAGER', 'tasks', 'create', '*'),
('p', 'MANAGER', 'tasks', 'read', '*'),
('p', 'MANAGER', 'tasks', 'update', '*'),
('p', 'MANAGER', 'floor-plans', 'read', '*'),
('p', 'MANAGER', 'floor-plans', 'update', '*'),
('p', 'MANAGER', 'integrations', 'read', '*'),
('p', 'MANAGER', 'users', 'read', '*'),
('p', 'MANAGER', 'contacts', 'create', '*'),
('p', 'MANAGER', 'contacts', 'read', '*'),
('p', 'MANAGER', 'contacts', 'update', '*'),
('p', 'MANAGER', 'contact-types', 'read', '*');

-- TECHNICIEN policies (19 total)
INSERT INTO casbin_rule (ptype, v0, v1, v2, v3) VALUES
('p', 'TECHNICIEN', 'sites', 'create', '*'),
('p', 'TECHNICIEN', 'sites', 'read', '*'),
('p', 'TECHNICIEN', 'sites', 'update', '*'),
('p', 'TECHNICIEN', 'assets', 'create', '*'),
('p', 'TECHNICIEN', 'assets', 'read', '*'),
('p', 'TECHNICIEN', 'assets', 'update', '*'),
('p', 'TECHNICIEN', 'assets', 'delete', '*'),
('p', 'TECHNICIEN', 'racks', 'create', '*'),
('p', 'TECHNICIEN', 'racks', 'read', '*'),
('p', 'TECHNICIEN', 'racks', 'update', '*'),
('p', 'TECHNICIEN', 'tasks', 'create', '*'),
('p', 'TECHNICIEN', 'tasks', 'read', '*'),
('p', 'TECHNICIEN', 'tasks', 'update', '*'),
('p', 'TECHNICIEN', 'floor-plans', 'read', '*'),
('p', 'TECHNICIEN', 'floor-plans', 'create', '*'),
('p', 'TECHNICIEN', 'floor-plans', 'update', '*'),
('p', 'TECHNICIEN', 'contacts', 'create', '*'),
('p', 'TECHNICIEN', 'contacts', 'read', '*'),
('p', 'TECHNICIEN', 'contacts', 'update', '*'),
('p', 'TECHNICIEN', 'contact-types', 'read', '*');

-- VIEWER policies (7 total)
INSERT INTO casbin_rule (ptype, v0, v1, v2, v3) VALUES
('p', 'VIEWER', 'sites', 'read', '*'),
('p', 'VIEWER', 'assets', 'read', '*'),
('p', 'VIEWER', 'racks', 'read', '*'),
('p', 'VIEWER', 'tasks', 'read', '*'),
('p', 'VIEWER', 'floor-plans', 'read', '*'),
('p', 'VIEWER', 'contacts', 'read', '*'),
('p', 'VIEWER', 'contact-types', 'read', '*');

-- Vérification finale
SELECT
  v0 as role,
  COUNT(*) as policies_count
FROM casbin_rule
WHERE ptype = 'p'
GROUP BY v0
ORDER BY v0;

-- Afficher sample par rôle
SELECT v0 as role, v1 as resource, v2 as action
FROM casbin_rule
WHERE ptype = 'p'
ORDER BY v0, v1, v2
LIMIT 80;
