import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch, type AuthUser } from '../lib/api';

type Field = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'email' | 'textarea' | 'select' | 'checkbox'; required?: boolean; options?: string[] };
type Resource = { key: string; label: string; permission: string; writePermission?: string; fields: Field[] };

const text = (key: string, label: string, required = false): Field => ({ key, label, required });
const date = (key: string, label: string, required = false): Field => ({ key, label, type: 'date', required });
const num = (key: string, label: string, required = false): Field => ({ key, label, type: 'number', required });
const area = (key: string, label: string, required = false): Field => ({ key, label, type: 'textarea', required });
const choice = (key: string, label: string, options: string[], required = false): Field => ({ key, label, type: 'select', options, required });

const RESOURCES: Record<string, Resource[]> = {
  animals: [{ key: 'animals', label: 'Animal Registry', permission: 'animals:read', writePermission: 'animals:write', fields: [
    text('animal_code','Animal code',true), text('name','Name',true), choice('species','Species',['Dog','Cat','Monkey','Bird','Squirrel','Guinea Pig','Reptile','Other'],true),
    text('breed','Breed'), choice('gender','Gender',['Male','Female','Unknown']), text('estimated_age_text','Estimated age'), date('rescue_date','Rescue date'),
    text('rescue_location','Rescue location'), text('microchip_or_tag','Microchip / tag'), text('kennel_zone','Kennel / zone'),
    choice('vaccination_status','Vaccination',['not_vaccinated','partial','up_to_date','pending']), choice('sterilization_status','Sterilization',['not_sterilized','scheduled','sterilized','not_applicable']),
    choice('current_status','Lifecycle status',['rescued','under_assessment','under_treatment','recovering','available_for_adoption','fostered','adopted','released','deceased']),
    choice('is_adoption_eligible','Adoption eligible',['0','1']), choice('is_foster_eligible','Foster eligible',['0','1']), choice('is_published_public','Publish publicly',['0','1']),
    area('health_summary','Health summary'), area('public_description','Public description'), area('internal_notes','Internal notes')
  ]}],
  rescue: [{ key: 'rescue_cases', label: 'Rescue Cases', permission: 'rescue:read', writePermission: 'rescue:write', fields: [
    text('case_code','Case code',true), text('reporter_name','Reporter name',true), text('reporter_phone','Reporter phone',true), text('reporter_email','Reporter email'),
    text('location_address','Rescue location / address',true), choice('priority','Priority',['low','medium','high','critical']),
    choice('status','Case status',['new','verified','assigned','in_progress','rescued','not_rescued','closed']),
    text('species','Species'), text('animal_description','Animal description',true), area('complaint_details','Reported issue',true),
    text('assigned_volunteer_id','Assigned volunteer ID'), area('rescue_team_notes','Team notes'), area('outcome_notes','Outcome notes')
  ]}],
  medical: [
    { key: 'medical_records', label: 'Consultations & Treatments', permission: 'medical:read', writePermission: 'medical:write', fields: [
      text('animal_id','Animal record ID',true), date('visit_date','Visit date',true), choice('record_type','Record type',['consultation','surgery','sterilization','deworming','lab_test','emergency','follow_up'],true),
      text('veterinarian_id','Veterinarian ID'), text('diagnosis','Diagnosis',true), area('symptoms','Symptoms'), area('prescription_text','Prescription'), area('treatment_notes','Treatment notes'), date('follow_up_date','Follow-up date')
    ]},
    { key: 'vaccinations', label: 'Vaccinations', permission: 'medical:read', writePermission: 'medical:write', fields: [
      text('animal_id','Animal record ID',true), text('vaccine_name','Vaccine name',true), text('batch_number','Batch number'),
      date('administered_date','Administered date',true), date('next_due_date','Next due date'), text('veterinarian_id','Veterinarian ID'), area('notes','Notes')
    ]},
    { key: 'veterinarians', label: 'Veterinarians & Clinics', permission: 'medical:read', writePermission: 'medical:write', fields: [
      text('name','Veterinarian name',true), text('clinic_name','Clinic'), text('registration_number','Registration number'), text('phone','Phone'), text('email','Email'), area('address','Address')
    ]}
  ],
  adoptions: [
    { key: 'adoption_applications', label: 'Adoption Applications', permission: 'adoption:read', writePermission: 'adoption:write', fields: [
      text('application_code','Application code',true), text('animal_id','Animal record ID',true), text('applicant_name','Applicant name',true), text('applicant_phone','Phone',true),
      text('applicant_email','Email'), area('applicant_address','Address',true), text('housing_type','Housing type'), choice('has_other_pets','Other pets',['0','1']),
      choice('home_check_status','Home check',['pending','scheduled','passed','failed']), area('home_check_notes','Home check notes'),
      choice('status','Application status',['application','initial_review','verification','approved','rejected','handover','follow_up','completed']), area('experience_notes','Experience')
    ]},
    { key: 'foster_applications', label: 'Foster Applications', permission: 'adoption:read', writePermission: 'adoption:write', fields: [
      text('application_code','Application code',true), text('animal_id','Animal record ID',true), text('applicant_name','Applicant name',true), text('applicant_phone','Phone',true),
      text('applicant_email','Email'), area('applicant_address','Address',true), date('foster_start_date','Foster start'), date('expected_end_date','Expected end'), area('notes','Notes')
    ]},
    { key: 'adoption_agreements', label: 'Adoption Agreements & Follow-ups', permission: 'adoption:read', writePermission: 'adoption:write', fields: [
      text('agreement_number','Agreement number',true), text('application_id','Application ID',true), text('animal_id','Animal record ID',true), date('handover_date','Handover date',true),
      date('follow_up_30d_date','30-day follow-up'), area('follow_up_30d_notes','30-day notes'), date('follow_up_90d_date','90-day follow-up'), area('follow_up_90d_notes','90-day notes')
    ]}
  ],
  finance: [
    { key: 'donors', label: 'Donor Directory', permission: 'donations:read', writePermission: 'donations:write', fields: [
      text('donor_code','Donor code',true), text('full_name','Donor name',true), text('email','Email'), text('phone','Phone'), text('pan_number','PAN'), area('address','Address'), choice('donor_type','Donor type',['individual','corporate','institutional'])
    ]},
    { key: 'donations', label: 'Donation Register', permission: 'donations:read', writePermission: 'donations:write', fields: [
      text('donor_id','Donor ID',true), text('fund_category_id','Fund category ID',true), text('account_id','Receiving account ID',true), date('donation_date','Donation date',true),
      num('amount_paise','Amount (paise)',true), choice('payment_mode','Payment mode',['upi','bank_transfer','cash','razorpay','cheque','other'],true), text('transaction_reference','Transaction reference'), area('purpose','Purpose')
    ]},
    { key: 'expenses', label: 'Expense Claims', permission: 'finance:read', writePermission: 'expenses:submit', fields: [
      text('expense_code','Expense code',true), date('expense_date','Expense date',true), choice('category','Category',['animal_food','vet_consultation','medicines','vaccination','sterilization','transportation','rescue_operations','shelter_maintenance','utilities','equipment','administrative','other'],true),
      text('fund_category_id','Fund category ID',true), text('account_id','Payment account ID',true), num('amount_paise','Amount (paise)',true), choice('payment_mode','Payment mode',['upi','bank_transfer','cash','card','other'],true),
      text('vendor_payee','Vendor / payee',true), text('animal_id','Animal ID'), text('rescue_case_id','Rescue case ID'), area('description','Description')
    ]},
    { key: 'financial_transactions', label: 'Immutable Ledger', permission: 'finance:read', fields: [] },
    { key: 'accounts', label: 'Chart of Accounts', permission: 'finance:read', fields: [] },
    { key: 'fund_categories', label: 'Fund Categories', permission: 'finance:read', fields: [] },
    { key: 'compliance_registrations', label: 'Statutory Compliance', permission: 'compliance:read', writePermission: 'compliance:write', fields: [
      choice('reg_type','Registration type',['society_registration','pan','ngo_darpan','12a','80g','awbi','csr1']), text('registration_number','Registration number'), text('issuing_authority','Issuing authority',true),
      choice('status','Status',['not_applied','applied','provisional','active','expired','rejected']), date('valid_from','Valid from'), date('valid_until','Valid until'), area('notes','Notes')
    ]}
  ],
  inventory: [
    { key: 'inventory_items', label: 'Stock Catalogue', permission: 'inventory:read', writePermission: 'inventory:write', fields: [
      text('sku','SKU',true), text('name','Item name',true), choice('category','Category',['dog_food','cat_food','medicines','vaccines','supplements','cleaning_supplies','medical_equipment','other'],true),
      choice('unit','Unit',['kg','g','l','ml','tablet','vial','bottle','pack','piece'],true), num('opening_stock','Opening stock'), num('current_stock','Current stock'), num('min_stock_threshold','Low-stock threshold'), text('preferred_supplier_id','Preferred supplier ID')
    ]},
    { key: 'stock_movements', label: 'Stock Movements', permission: 'inventory:read', writePermission: 'inventory:write', fields: [
      text('item_id','Inventory item ID',true), choice('movement_type','Movement type',['opening','purchase','issue','adjustment','write_off','return'],true), num('quantity_delta','Quantity change',true),
      text('batch_number','Batch number'), date('expiry_date','Expiry date'), text('animal_id','Animal ID'), text('purchase_order_id','Purchase order ID'), area('notes','Notes')
    ]},
    { key: 'suppliers', label: 'Suppliers', permission: 'inventory:read', writePermission: 'inventory:write', fields: [
      text('name','Supplier name',true), text('contact_person','Contact person'), text('phone','Phone'), text('email','Email'), text('gstin','GSTIN'), area('address','Address'), text('category','Category')
    ]},
    { key: 'purchase_orders', label: 'Purchase Orders', permission: 'inventory:read', writePermission: 'inventory:write', fields: [
      text('po_number','PO number',true), text('supplier_id','Supplier ID',true), date('order_date','Order date',true), choice('status','Status',['draft','ordered','received','cancelled']), num('total_amount_paise','Total amount (paise)')
    ]}
  ],
  volunteers: [
    { key: 'volunteers', label: 'Volunteer & Member Directory', permission: 'volunteers:read', writePermission: 'volunteers:write', fields: [
      text('volunteer_code','Volunteer code',true), text('full_name','Full name',true), text('phone','Phone',true), text('email','Email'), area('address','Address'),
      text('emergency_contact_name','Emergency contact'), text('emergency_contact_phone','Emergency phone'), area('skills_json','Skills (JSON array)'), text('availability','Availability'),
      choice('role_type','Type',['volunteer','member']), choice('status','Status',['applicant','active','inactive']), date('joined_date','Joined date'), area('notes','Notes')
    ]},
    { key: 'volunteer_tasks', label: 'Tasks & Attendance', permission: 'volunteers:read', writePermission: 'volunteers:write', fields: [
      text('volunteer_id','Volunteer ID',true), choice('task_type','Task type',['feeding','rescue','shelter_care','medical_assist','event','transport','admin'],true),
      text('title','Task title',true), area('description','Description'), date('scheduled_date','Scheduled date',true), num('hours_logged','Hours logged'), choice('attendance_status','Attendance',['assigned','completed','missed','cancelled'])
    ]}
  ],
  cms: [{ key: 'website_content', label: 'Website Content Drafts', permission: 'cms:read', writePermission: 'cms:write', fields: [
    text('page_slug','Page slug',true), text('section_key','Section key',true), text('title','Title',true), area('body_json','Content body (JSON)',true),
    text('media_asset_id','Media asset ID'), text('seo_title','SEO title'), area('seo_description','SEO description')
  ]}]
};

const TITLES: Record<string,string> = {
  animals: 'Animal Registry & Lifecycle', rescue: 'Rescue Case Management', medical: 'Veterinary & Medical Records',
  adoptions: 'Adoption & Foster Management', finance: 'Donations, Finance & Compliance', inventory: 'Shelter Inventory & Procurement',
  volunteers: 'Volunteers & Tasks', cms: 'Website Content Management'
};

interface Props { user: AuthUser; }

export const ModuleWorkspacePage: React.FC<Props> = ({ user }) => {
  const { moduleKey = '' } = useParams();
  const resources = RESOURCES[moduleKey] || [];
  const available = useMemo(() => resources.filter((r) => user.permissions.includes(r.permission)), [resources, user.permissions]);
  const [resourceKey, setResourceKey] = useState('');
  const resource = available.find((r) => r.key === resourceKey) || available[0];
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<Record<string,string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const canWrite = !!resource?.writePermission && user.permissions.includes(resource.writePermission);
  const canEdit = canWrite && !['medical_records','vaccinations','donations','expenses','financial_transactions','stock_movements'].includes(resource?.key || '');
  const canWorkflow = !!resource && ((resource.key === 'donations' && user.permissions.includes('donations:verify')) || (resource.key === 'expenses' && (user.permissions.includes('finance:approve') || user.permissions.includes('finance:ledger'))) || (resource.key === 'stock_movements' && user.permissions.includes('inventory:approve')) || (['adoption_applications','foster_applications'].includes(resource.key) && user.permissions.includes('adoption:approve')));

  const load = async () => {
    if (!resource) return;
    const result = await apiFetch<{ items: Record<string,unknown>[] }>(`/api/v1/admin/modules/${resource.key}?limit=100&q=${encodeURIComponent(search)}`);
    if (result.success && result.data) setRows(result.data.items);
    else setFeedback(result.error?.message || 'Unable to load records.');
  };

  useEffect(() => { setResourceKey(''); setForm({}); setEditingId(null); setSearch(''); setFeedback(''); }, [moduleKey]);
  useEffect(() => { void load(); }, [resourceKey, moduleKey, search]);

  const reset = () => { setForm({}); setEditingId(null); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resource) return;
    setBusy(true); setFeedback('');
    const payload: Record<string,string|number|boolean|null> = {};
    for (const field of resource.fields) {
      const value = form[field.key];
      if (value === undefined || value === '') continue;
      if (field.type === 'number') payload[field.key] = Number(value);
      else if (field.key.startsWith('is_') || field.key === 'has_other_pets') payload[field.key] = value === '1';
      else payload[field.key] = value;
    }
    const result = await apiFetch(editingId ? `/api/v1/admin/modules/${resource.key}/${editingId}` : `/api/v1/admin/modules/${resource.key}`, {
      method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(payload)
    });
    setBusy(false);
    if (result.success) { setFeedback(editingId ? 'Record updated.' : 'Record created.'); reset(); await load(); }
    else setFeedback(result.error?.message || 'Save failed.');
  };

  const beginEdit = (row: Record<string,unknown>) => {
    if (!resource) return;
    const id = String(row.id || '');
    const next: Record<string,string> = {};
    for (const field of resource.fields) {
      const value = row[field.key];
      if (value !== null && value !== undefined) next[field.key] = String(value);
    }
    setForm(next); setEditingId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const actionsForRow = (row: Record<string,unknown>) => {
    if (!resource) return [] as string[];
    const status = String(row.status || row.approval_status || row.verification_status || '');
    if (resource.key === 'donations' && status === 'pending' && user.permissions.includes('donations:verify')) return ['verify'];
    if (resource.key === 'expenses' && status === 'pending' && user.permissions.includes('finance:approve')) return ['approve','reject'];
    if (resource.key === 'expenses' && status === 'approved' && row.payment_status === 'unpaid' && user.permissions.includes('finance:ledger')) return ['paid'];
    if (resource.key === 'stock_movements' && status === 'pending' && user.permissions.includes('inventory:approve')) return ['approve'];
    if (['adoption_applications','foster_applications'].includes(resource.key) && !['approved','rejected','completed'].includes(status) && user.permissions.includes('adoption:approve')) return ['approve','reject'];
    return [];
  };

  const runWorkflow = async (action: string, row: Record<string,unknown>) => {
    if (!resource) return;
    const id = String(row.id || '');
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Enter the reason for rejection:') || '';
      if (!reason.trim()) return;
    } else if (!window.confirm(action === 'paid' ? 'Confirm this approved expense has actually been paid and post it to the ledger?' : action === 'verify' ? 'Verify this donation and post the income ledger entry?' : 'Approve this record?')) return;
    const suffix = action === 'verify' ? '/donations/' + id + '/verify' : action === 'paid' ? '/expenses/' + id + '/mark-paid' : '/' + resource.key + '/' + id + '/' + action;
    const result = await apiFetch('/api/v1/admin/modules' + suffix, { method: 'POST', body: action === 'reject' ? JSON.stringify({ reason }) : undefined });
    setFeedback(result.success ? (action === 'paid' ? 'Expense marked paid and posted to the ledger.' : action === 'verify' ? 'Donation verified and posted to the ledger.' : (action === 'reject' ? 'Record rejected.' : 'Record approved.')) : result.error?.message || 'Workflow action failed.');
    await load();
  };

  if (!resources.length || !available.length) return <section className="rounded-2xl border border-slate-200 bg-white p-6"><h1 className="text-xl font-bold">Access unavailable</h1><p className="mt-2 text-sm text-slate-600">This module is not available to your current ERP role.</p></section>;

  const columns = resource?.key === 'financial_transactions'
    ? ['txn_number','txn_date','entry_type','amount_paise','reference_type','narration']
    : resource?.key === 'accounts' ? ['code','name','account_type','current_balance_paise','is_active']
    : resource?.key === 'fund_categories' ? ['code','name','is_restricted','description']
    : resource?.fields.map((f) => f.key).slice(0, 7) || [];
  if (resource?.key === 'donations') columns.push('verification_status');
  if (resource?.key === 'expenses') columns.push('approval_status','payment_status');
  if (resource?.key === 'stock_movements') columns.push('approval_status');
  if (resource?.key === 'adoption_applications' || resource?.key === 'foster_applications') columns.push('status');

  if (resource && !columns.includes('id')) columns.unshift('id');

  return <div className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-wider text-orange-700">Paw&apos;s Hopez Society · NGO ERP</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">{TITLES[moduleKey] || 'ERP Module'}</h1><p className="mt-1 text-sm text-slate-600">Operational records, workflows and history.</p></div>
      <div className="sm:w-72"><label className="mb-1 block text-xs font-bold uppercase text-slate-500">Workspace</label><select value={resource?.key || ''} onChange={(e) => { setResourceKey(e.target.value); reset(); }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">{available.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
    </header>
    {feedback && <div role="status" className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">{feedback}</div>}
    {canWrite && resource && resource.fields.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-slate-900">{editingId ? 'Update record' : `Add ${resource.label}`}</h2>{editingId && <button type="button" onClick={reset} className="text-sm font-semibold text-slate-600 underline">Cancel edit</button>}</div>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {resource.fields.map((field) => <label key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}><span className="mb-1 block text-xs font-bold text-slate-600">{field.label}{field.required ? ' *' : ''}</span>
          {field.type === 'textarea' ? <textarea required={field.required} value={form[field.key] || ''} onChange={(e) => setForm((v) => ({...v,[field.key]:e.target.value}))} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          : field.type === 'select' ? <select required={field.required} value={form[field.key] || ''} onChange={(e) => setForm((v) => ({...v,[field.key]:e.target.value}))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Select…</option>{field.options?.map((option) => <option key={option} value={option}>{option.replaceAll('_',' ')}</option>)}</select>
          : <input required={field.required} type={field.type || 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? 'any' : undefined} value={form[field.key] || ''} onChange={(e) => setForm((v) => ({...v,[field.key]:e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />}
        </label>)}
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-3"><button disabled={busy} className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create record'}</button></div>
      </form>
    </section>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">{resource?.label}</h2><p className="text-xs text-slate-500">{rows.length} records loaded · maximum 100 per search</p></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records…" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64" /></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{columns.map((col) => <th key={col} className="px-4 py-3">{col.replaceAll('_',' ')}</th>)}{(canEdit || canWorkflow) && <th className="px-4 py-3 text-right">Action</th>}</tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={columns.length + (canEdit || canWorkflow ? 1 : 0)} className="px-4 py-10 text-center text-slate-500">No records found.</td></tr> : rows.map((row) => <tr key={String(row.id)}>{columns.map((col) => <td key={col} className="max-w-xs truncate px-4 py-3 text-slate-700">{row[col] === null || row[col] === undefined ? '—' : String(row[col])}</td>)}{(canEdit || canWorkflow) && <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2">{canEdit && <button type="button" onClick={() => beginEdit(row)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Edit</button>}{actionsForRow(row).map((action) => <button key={action} type="button" onClick={() => void runWorkflow(action,row)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold capitalize text-white hover:bg-slate-700">{action === 'paid' ? 'Mark paid' : action === 'verify' ? 'Verify' : action}</button>)}</div></td>}</tr>)}</tbody></table></div>
    </section>
    <p className="text-xs text-slate-500">Financial ledger entries and medical/vaccination records are append-only in this workspace. Financial approval, payment, statutory receipt issuance and live CMS publishing require their dedicated controlled workflows before production use.</p>
  </div>;
};
