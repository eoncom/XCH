-- Script d'insertion policies Casbin RBAC manquantes
-- Date: 2026-01-29
-- Context: Correction tests E2E RBAC (0/42 tests passent)
-- Problème: Seules policies ADMIN présentes, manque MANAGER/TECHNICIEN/VIEWER

-- Supprimer anciennes policies non-ADMIN (au cas où)
DELETE FROM casbin_rule WHERE ptype = 'p' AND v0 IN ('MANAGER', 'TECHNICIEN', 'VIEWER');

-- MANAGER policies (10 total)
-- Manager peut lire tout, créer/modifier tasks et floor-plans
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
('p', 'MANAGER', 'users', 'read', '*');

-- TECHNICIEN policies (16 total)
-- Technicien peut tout faire SAUF delete sites/tasks, et gérer users/tenants
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
('p', 'TECHNICIEN', 'floor-plans', 'update', '*');

-- VIEWER policies (5 total)
-- Viewer peut uniquement LIRE (read-only)
INSERT INTO casbin_rule (ptype, v0, v1, v2, v3) VALUES
('p', 'VIEWER', 'sites', 'read', '*'),
('p', 'VIEWER', 'assets', 'read', '*'),
('p', 'VIEWER', 'racks', 'read', '*'),
('p', 'VIEWER', 'tasks', 'read', '*'),
('p', 'VIEWER', 'floor-plans', 'read', '*');

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
LIMIT 50;
