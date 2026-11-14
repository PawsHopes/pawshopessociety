import React from 'react';
import { useParams } from 'react-router-dom';
import type { AuthUser } from '../lib/api';

interface ModuleInfo {
  title: string;
  phase: string;
  summary: string;
  permission: string;
}

const MODULE_INFO: Record<string, ModuleInfo> = {
  animals: {
    title: 'Animal Registry & Lifecycle Timeline',
    phase: 'Phase 4 (Core ERP)',
    summary: 'Manage shelter animals, kennel zones, caretakers, sterilization status, photos, and full status histories.',
    permission: 'animals:read',
  },
  rescue: {
    title: '24/7 Emergency Rescue Case Management',
    phase: 'Phase 4 (Core ERP)',
    summary: 'Track rescue calls from intake through verification, assignment, rescue, and closure with field notes.',
    permission: 'rescue:read',
  },
  medical: {
    title: 'Veterinary Consultations, Prescriptions & Vaccination Alerts',
    phase: 'Phase 4 (Core ERP)',
    summary: 'Record vet visits, diagnoses, prescriptions, vaccination due dates, and medical expenses.',
    permission: 'medical:read',
  },
  adoptions: {
    title: 'Adoption & Foster Application Pipelines',
    phase: 'Phase 4 (Core ERP)',
    summary: 'Process adopter screening, home checks, handover agreements, and post-adoption follow-ups.',
    permission: 'adoption:read',
  },
  finance: {
    title: 'Donations, Receipts & Immutable Double-Entry Ledger',
    phase: 'Phase 5 (Finance & Ops)',
    summary: 'Verify donations, issue receipts, approve expenses, and maintain fund accounting.',
    permission: 'finance:read',
  },
  inventory: {
    title: 'Shelter Food, Medicine & Supply Inventory',
    phase: 'Phase 5 (Finance & Ops)',
    summary: 'Track food, medicines, batch expiry dates, low-stock alerts, and supplier purchase orders.',
    permission: 'inventory:read',
  },
  volunteers: {
    title: 'Volunteer & Member Directory',
    phase: 'Phase 5 (Finance & Ops)',
    summary: 'Coordinate feeding shifts, rescue volunteers, attendance logs, and skills.',
    permission: 'volunteers:read',
  },
  cms: {
    title: 'Public Website CMS (No-Code Publishing)',
    phase: 'Phase 6 (CMS & Cutover)',
    summary: 'Manage website content, rescue stories, gallery photos, announcements, and adoption listings.',
    permission: 'cms:read',
  },
};

interface Props {
  user: AuthUser;
}

export const ModulePreviewPage: React.FC<Props> = ({ user }) => {
  const { moduleKey = '' } = useParams();
  const info = MODULE_INFO[moduleKey];

  if (!info) {
    return <section role="alert" className="rounded-xl border border-slate-200 bg-white p-6"><h1 className="font-bold">Module not found</h1><p className="mt-2 text-sm text-slate-600">This ERP section does not exist.</p></section>;
  }

  if (!user.permissions.includes(info.permission)) {
    return <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-slate-800"><h1 className="font-semibold">Access denied</h1><p className="mt-2 text-sm">Your ERP role does not have permission to view this section.</p></section>;
  }

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm max-w-2xl">
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-brandOrange">{info.phase}</span>
      <h1 className="text-2xl font-extrabold text-slate-900 mt-3">{info.title}</h1>
      <p className="text-slate-600 text-sm mt-2 leading-relaxed">{info.summary}</p>
      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-900">Planned — not implemented</p>
        <p className="mt-1 text-sm text-amber-900">
          This is a roadmap placeholder, not an operational module. Its complete UI, API, permission checks, workflow tests, and data migration verification must be finished before it can be used with live Society records.
        </p>
      </div>
    </div>
  );
};
