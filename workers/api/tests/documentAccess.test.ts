
import { describe, it, expect } from 'vitest';
import type { AuthUser } from '../src/types/env';
import { effectivePermissions } from '../src/middleware/rbac';

import {
  canReadDocumentCategory,
  canUploadDocumentCategory
} from '../src/services/documentAccess';

function makeUser(
  roleCode: AuthUser['roleCode'],
  permissions: string[]
): AuthUser {
  return {
    id: 'test-user',
    email: 'test@example.org',
    fullName: 'Test User',
    roleCode,
    roleName: roleCode,
    permissions
  };
}

describe('Document access permissions', () => {

  it('allows veterinary staff to access medical documents', () => {
    const vet = makeUser('vet_staff', [
      'documents:private_read',
      'medical:read',
      'medical:write'
    ]);

    expect(canUploadDocumentCategory(vet, 'prescription')).toBe(true);
    expect(canReadDocumentCategory(vet, 'lab_report')).toBe(true);
  });

  it('blocks veterinary staff from donor documents', () => {
    const vet = makeUser('vet_staff', [
      'documents:private_read',
      'medical:read',
      'medical:write'
    ]);

    expect(canUploadDocumentCategory(vet, 'donor_proof')).toBe(false);
    expect(canReadDocumentCategory(vet, 'donor_proof')).toBe(false);
  });

  it('allows finance staff to access finance documents', () => {
    const finance = makeUser('finance_manager', [
      'documents:private_read',
      'finance:read',
      'expenses:submit',
      'donations:read',
      'donations:write'
    ]);

    expect(canUploadDocumentCategory(finance, 'expense_invoice')).toBe(true);
    expect(canReadDocumentCategory(finance, 'donation_receipt')).toBe(true);
  });

  it('blocks finance staff from applicant identity documents', () => {
    const finance = makeUser('finance_manager', [
      'documents:private_read',
      'finance:read',
      'expenses:submit'
    ]);

    expect(canReadDocumentCategory(finance, 'applicant_id')).toBe(false);
  });

  it('blocks unknown document categories', () => {
    const auditor = makeUser('auditor', [
      'documents:private_read',
      'finance:read'
    ]);

    expect(canReadDocumentCategory(auditor, 'unknown_category')).toBe(false);
    expect(canUploadDocumentCategory(auditor, 'unknown_category')).toBe(false);
  });

  it('allows primary Super Admin access through explicit document permissions', () => {
    const admin = makeUser('super_admin', [
      'documents:private_read',
      'compliance:read',
      'compliance:write'
    ]);
    admin.email = 'hopezpaws@gmail.com';

    expect(canUploadDocumentCategory(admin, 'compliance_cert')).toBe(true);
    expect(canReadDocumentCategory(admin, 'compliance_cert')).toBe(true);
    expect(canUploadDocumentCategory(admin, 'other')).toBe(false);
  });

  it('grants both designated Super Admins the same private document access', () => {
    for (const email of ['infosecayush@gmail.com', 'yivam24770@jcaton.com']) {
      const permissions = effectivePermissions('super_admin', email, [
        'documents:private_read',
        'compliance:read',
        'compliance:write'
      ]);
      const admin = makeUser('super_admin', permissions);
      admin.email = email;

      expect(canUploadDocumentCategory(admin, 'compliance_cert')).toBe(true);
      expect(canReadDocumentCategory(admin, 'compliance_cert')).toBe(true);
    }
  });

});
