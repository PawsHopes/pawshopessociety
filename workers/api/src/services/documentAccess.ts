
import type { AuthUser } from '../types/env';

const READ_PERMISSION: Record<string, string> = {
  vet_bill: 'medical:read',
  prescription: 'medical:read',
  lab_report: 'medical:read',
  vaccination_cert: 'medical:read',

  adoption_agreement: 'adoption:read',
  foster_agreement: 'adoption:read',
  applicant_id: 'adoption:read',

  donor_proof: 'donations:read',
  donation_receipt: 'donations:read',

  expense_invoice: 'finance:read',
  purchase_invoice: 'inventory:read',

  compliance_cert: 'compliance:read',
  rescue_evidence: 'rescue:read',
};

const WRITE_PERMISSION: Record<string, string> = {
  vet_bill: 'medical:write',
  prescription: 'medical:write',
  lab_report: 'medical:write',
  vaccination_cert: 'medical:write',

  adoption_agreement: 'adoption:write',
  foster_agreement: 'adoption:write',
  applicant_id: 'adoption:write',

  donor_proof: 'donations:write',
  donation_receipt: 'donations:write',

  expense_invoice: 'expenses:submit',
  purchase_invoice: 'inventory:write',

  compliance_cert: 'compliance:write',
  rescue_evidence: 'rescue:write',
};

export function canReadDocumentCategory(
  user: AuthUser,
  category: string
): boolean {
  if (user.roleCode === 'super_admin') return true;

  if (!user.permissions.includes('documents:private_read')) {
    return false;
  }

  if (category === 'other') return false;
  const permission = READ_PERMISSION[category];

  return permission !== undefined &&
    user.permissions.includes(permission);
}

export function canUploadDocumentCategory(
  user: AuthUser,
  category: string
): boolean {
  if (user.roleCode === 'super_admin') return true;

  if (category === 'other') return false;
  const permission = WRITE_PERMISSION[category];

  return permission !== undefined &&
    user.permissions.includes(permission);
}
