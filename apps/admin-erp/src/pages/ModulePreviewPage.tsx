import React from 'react';
import { useParams } from 'react-router-dom';

const MODULE_INFO: Record<string, { title: string; phase: string; summary: string }> = {
  animals: {
    title: 'Animal Registry & Lifecycle Timeline',
    phase: 'Phase 4 (Core ERP)',
    summary:
      'Manage all shelter animals, kennel zones, caretakers, sterilization status, photos, and full status histories.',
  },
  rescue: {
    title: '24/7 Emergency Rescue Case Management',
    phase: 'Phase 4 (Core ERP)',
    summary:
      'Track rescue calls from New -> Verified -> Assigned -> In Progress -> Rescued -> Closed with GPS coordinates and field notes.',
  },
  medical: {
    title: 'Veterinary Consultations, Prescriptions & Vaccination Alerts',
    phase: 'Phase 4 (Core ERP)',
    summary:
      'Record vet visits, diagnoses, prescriptions, vaccination due dates, and submit vet bills for Finance approval.',
  },
  adoptions: {
    title: 'Adoption & Foster Application Pipelines',
    phase: 'Phase 4 (Core ERP)',
    summary:
      'Process adopter screening, home checks, handover agreements, and 30/90-day post-adoption follow-ups.',
  },
  finance: {
    title: 'Donations, Receipts & Immutable Double-Entry Ledger',
    phase: 'Phase 5 (Finance & Ops)',
    summary:
      'Verify UPI/Bank/Razorpay donations, issue compliant receipts, approve expenses, and maintain immutable fund accounting.',
  },
  inventory: {
    title: 'Shelter Food, Medicine & Supply Inventory',
    phase: 'Phase 5 (Finance & Ops)',
    summary:
      'Track dog/cat food bags, medicines, batch expiry dates, low-stock alerts, and supplier purchase orders.',
  },
  volunteers: {
    title: 'Volunteer & Member Directory',
    phase: 'Phase 5 (Finance & Ops)',
    summary:
      'Coordinate feeding shifts, rescue volunteers, attendance logs, and skills.',
  },
  cms: {
    title: 'Public Website CMS (No-Code Publishing)',
    phase: 'Phase 6 (CMS & Cutover)',
    summary:
      'Update homepage stats, rescue stories, gallery photos, announcements, and adoption listings without editing HTML.',
  },
};

export const ModulePreviewPage: React.FC = () => {
  const { moduleKey = 'animals' } = useParams();
  const info = MODULE_INFO[moduleKey] || MODULE_INFO.animals;

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm max-w-2xl">
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-brandOrange">
        {info.phase}
      </span>
      <h1 className="text-2xl font-extrabold text-slate-900 mt-3">{info.title}</h1>
      <p className="text-slate-600 text-sm mt-2 leading-relaxed">{info.summary}</p>
      <p className="text-xs text-slate-400 mt-4">
        Database tables, foreign keys, and RBAC permissions for this module are already provisioned in
        Phase 3 D1 migrations.
      </p>
    </div>
  );
};
