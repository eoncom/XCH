-- Script COMPLET d'insertion policies Casbin RBAC
-- Date: 2026-02-06
-- Context: TOUTES les policies pour TOUS les rôles
-- Usage: docker compose exec postgres psql -U xch_user -d xch_dev -f /path/to/insert-rbac-policies.sql
-- Ou copier-coller dans psql

-- Nettoyer TOUT
DELETE FROM casbin_rule;

-- =====================================================
-- ADMIN : accès CRUD complet sur TOUTES les ressources
-- =====================================================
INSERT INTO casbin_rule (ptype, v0, v1, v2, v3) VALUES
('p', 'ADMIN', 'sites', 'create', '*'),
('p', 'ADMIN', 'sites', 'read', '*'),
('p', 'ADMIN', 'sites', 'update', '*'),
('p', 'ADMIN', 'sites', 'delete', '*'),
('p', 'ADMIN', 'assets', 'create', '*'),
('p', 'ADMIN', 'assets', 'read', '*'),
('p', 'ADMIN', 'assets', 'update', '*'),
('p', 'ADMIN', 'assets', 'delete', '*'),
('p', 'ADMIN', 'racks', 'create', '*'),
('p', 'ADMIN', 'racks', 'read', '*'),
('p', 'ADMIN', 'racks', 'update', '*'),
('p', 'ADMIN', 'racks', 'delete', '*'),
('p', 'ADMIN', 'tasks', 'create', '*'),
('p', 'ADMIN', 'tasks', 'read', '*'),
('p', 'ADMIN', 'tasks', 'update', '*'),
('p', 'ADMIN', 'tasks', 'delete', '*'),
('p', 'ADMIN', 'floor-plans', 'create', '*'),
('p', 'ADMIN', 'floor-plans', 'read', '*'),
('p', 'ADMIN', 'floor-plans', 'update', '*'),
('p', 'ADMIN', 'floor-plans', 'delete', '*'),
('p', 'ADMIN', 'integrations', 'create', '*'),
('p', 'ADMIN', 'integrations', 'read', '*'),
('p', 'ADMIN', 'integrations', 'update', '*'),
('p', 'ADMIN', 'integrations', 'delete', '*'),
('p', 'ADMIN', 'users', 'create', '*'),
('p', 'ADMIN', 'users', 'read', '*'),
('p', 'ADMIN', 'users', 'update', '*'),
('p', 'ADMIN', 'users', 'delete', '*'),
('p', 'ADMIN', 'tenants', 'create', '*'),
('p', 'ADMIN', 'tenants', 'read', '*'),
('p', 'ADMIN', 'tenants', 'update', '*'),
('p', 'ADMIN', 'tenants', 'delete', '*'),
('p', 'ADMIN', 'contacts', 'create', '*'),
('p', 'ADMIN', 'contacts', 'read', '*'),
('p', 'ADMIN', 'contacts', 'update', '*'),
('p', 'ADMIN', 'contacts', 'delete', '*'),
('p', 'ADMIN', 'contact-types', 'create', '*'),
('p', 'ADMIN', 'contact-types', 'read', '*'),
('p', 'ADMIN', 'contact-types', 'update', '*'),
('p', 'ADMIN', 'contact-types', 'delete', '*');

-- =====================================================
-- MANAGER : lecture étendue + gestion tasks/contacts
-- =====================================================
INSERT INTO casbin_rule (ptype, v0, v1, v2, v3) VALUES
('p', 'MANAGER', 'sites', 'read', '*'),
('p', 'MANAGER', 'sites', 'update', '*'),
('p', 'MANAGER', 'assets', 'read', '*'),
('p', 'MANAGER', 'assets', 'update', '*'),
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

-- =====================================================
-- TECHNICIEN : opérations terrain complètes
-- =====================================================
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

-- =====================================================
-- VIEWER : lecture seule
-- =====================================================
INSERT INTO casbin_rule (ptype, v0, v1, v2, v3) VALUES
('p', 'VIEWER', 'sites', 'read', '*'),
('p', 'VIEWER', 'assets', 'read', '*'),
('p', 'VIEWER', 'racks', 'read', '*'),
('p', 'VIEWER', 'tasks', 'read', '*'),
('p', 'VIEWER', 'floor-plans', 'read', '*'),
('p', 'VIEWER', 'contacts', 'read', '*'),
('p', 'VIEWER', 'contact-types', 'read', '*');

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT v0 AS role, COUNT(*) AS policies_count
FROM casbin_rule WHERE ptype = 'p'
GROUP BY v0 ORDER BY v0;
-- Attendu: ADMIN=40, MANAGER=16, TECHNICIEN=20, VIEWER=7 → Total=83
