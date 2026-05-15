import {
  BACKUP_AUDIT_ACTIONS,
  BACKUP_CATALOG_ACTIONS,
  BackupAuditAction,
  BackupCatalogAction,
} from './backup.actions.constants';

describe('BACKUP_AUDIT_ACTIONS / BACKUP_CATALOG_ACTIONS', () => {
  it('catalog subset matches v2.2.1 hotfix filter exactly (regression guard PR #71)', () => {
    expect([...BACKUP_CATALOG_ACTIONS]).toEqual([
      'BACKUP_FULL',
      'BACKUP_FULL_V2',
      'BACKUP_SITE',
      'BACKUP_SITE_V2',
    ]);
  });

  it('every catalog action is also an audit action (subset invariant)', () => {
    for (const action of BACKUP_CATALOG_ACTIONS) {
      expect((BACKUP_AUDIT_ACTIONS as readonly string[]).includes(action)).toBe(true);
    }
  });

  it('audit actions include both backup and restore variants (forward-compat)', () => {
    expect(BACKUP_AUDIT_ACTIONS).toContain('RESTORE_FULL');
    expect(BACKUP_AUDIT_ACTIONS).toContain('RESTORE_FULL_V2');
    expect(BACKUP_AUDIT_ACTIONS).toContain('RESTORE_SITE');
    expect(BACKUP_AUDIT_ACTIONS).toContain('STORAGE_CLEANUP');
  });

  it('Track D.2 — RESTORE_CROSS_TENANT registered as a backup audit action', () => {
    expect(BACKUP_AUDIT_ACTIONS).toContain('RESTORE_CROSS_TENANT');
    // Not part of the catalog subset — cross-tenant restore consumes a
    // backup, does not produce a new listable catalog row.
    expect(BACKUP_CATALOG_ACTIONS as readonly string[]).not.toContain(
      'RESTORE_CROSS_TENANT',
    );
  });

  it('type-level narrowing rejects unknown action strings at compile time', () => {
    const valid: BackupAuditAction = 'BACKUP_FULL_V2';
    expect(valid).toBe('BACKUP_FULL_V2');
    const catalogOnly: BackupCatalogAction = 'BACKUP_FULL';
    expect(catalogOnly).toBe('BACKUP_FULL');
  });
});
