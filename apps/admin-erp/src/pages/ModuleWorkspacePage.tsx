import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch, type AuthUser } from '../lib/api';

type Field = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'email' | 'textarea' | 'select' | 'checkbox'; required?: boolean; options?: string[]; optionLabels?: Record<string, string>; relationResource?: string };
type Resource = { key: string; label: string; permission: string; writePermission?: string; fields: Field[] };

const text = (key: string, label: string, required = false): Field => ({ key, label, required });
const date = (key: string, label: string, required = false): Field => ({ key, label, type: 'date', required });
const num = (key: string, label: string, required = false): Field => ({ key, label, type: 'number', required });
const area = (key: string, label: string, required = false): Field => ({ key, label, type: 'textarea', required });
const choice = (key: string, label: string, options: string[], required = false, optionLabels?: Record<string, string>): Field => ({ key, label, type: 'select', options, optionLabels, required });
const relation = (key: string, label: string, relationResource: string, required = false): Field => ({ key, label, type: 'select', relationResource, required });

const RESOURCES: Record<string, Resource[]> = {
  animals: [{ key: 'animals', label: 'Animal Registry', permission: 'animals:read', writePermission: 'animals:write', fields: [
    text('animal_code','Animal code',true), text('name','Name',true), choice('species','Species',['Dog','Cat','Monkey','Bird','Squirrel','Guinea Pig','Reptile','Other'],true),
    text('breed','Breed'), choice('gender','Gender',['Male','Female','Unknown']), text('estimated_age_text','Estimated age'), date('rescue_date','Rescue date'),
    text('rescue_location','Rescue location'), text('microchip_or_tag','Microchip / tag'), text('kennel_zone','Kennel / zone'), text('legacy_slug','Legacy slug'), text('estimated_dob','Estimated date of birth'), text('identification_marks','Identification marks'), text('rescue_source','Rescue source'), relation('rescue_case_id','Rescue case','rescue_cases'), date('sterilization_date','Sterilization date'), text('caretaker_user_id','Caretaker user ID'), area('adopted_note','Adoption note'),
    choice('vaccination_status','Vaccination',['not_vaccinated','partial','up_to_date','pending']), choice('sterilization_status','Sterilization',['not_sterilized','scheduled','sterilized','not_applicable']),
    choice('current_status','Lifecycle status',['rescued','under_assessment','under_treatment','recovering','available_for_adoption','fostered','adopted','released','deceased']),
    choice('is_adoption_eligible','Adoption eligible',['0','1']), choice('is_foster_eligible','Foster eligible',['0','1']), choice('is_published_public','Publish publicly',['0','1']),
    area('health_summary','Health summary'), area('public_description','Public description'), area('internal_notes','Internal notes')
  ]}],
  rescue: [{ key: 'rescue_cases', label: 'Rescue Cases', permission: 'rescue:read', writePermission: 'rescue:write', fields: [
    text('case_code','Case code',true), text('reporter_name','Reporter name',true), text('reporter_phone','Reporter phone',true), text('reporter_email','Reporter email'), num('latitude','Latitude'), num('longitude','Longitude'),
    text('location_address','Rescue location / address',true), choice('priority','Priority',['low','medium','high','critical']),
    choice('status','Case status',['new','verified','assigned','in_progress','rescued','not_rescued','closed']),
    choice('species','Species',['Dog','Cat','Monkey','Bird','Squirrel','Guinea Pig','Reptile','Other']), text('animal_description','Animal description',true), area('complaint_details','Reported issue',true),
    relation('assigned_volunteer_id','Assigned volunteer','volunteers'), area('rescue_team_notes','Team notes'), area('outcome_notes','Outcome notes')
  ]}],
  medical: [
    { key: 'medical_records', label: 'Consultations & Treatments', permission: 'medical:read', writePermission: 'medical:write', fields: [
      relation('animal_id','Animal record', 'animals', true), date('visit_date','Visit date',true), choice('record_type','Record type',['consultation','surgery','sterilization','deworming','lab_test','emergency','follow_up'],true),
      relation('veterinarian_id','Veterinarian','veterinarians'), text('diagnosis','Diagnosis',true), area('symptoms','Symptoms'), area('prescription_text','Prescription'), area('medication_history_notes','Medication history'), area('treatment_notes','Treatment notes'), date('follow_up_date','Follow-up date')
    ]},
    { key: 'vaccinations', label: 'Vaccinations', permission: 'medical:read', writePermission: 'medical:write', fields: [
      relation('animal_id','Animal record','animals',true), text('vaccine_name','Vaccine name',true), text('batch_number','Batch number'),
      date('administered_date','Administered date',true), date('next_due_date','Next due date'), relation('veterinarian_id','Veterinarian','veterinarians'), area('notes','Notes')
    ]},
    { key: 'veterinarians', label: 'Veterinarians & Clinics', permission: 'medical:read', writePermission: 'medical:write', fields: [
      text('name','Veterinarian name',true), text('clinic_name','Clinic'), text('registration_number','Registration number'), text('phone','Phone'), text('email','Email'), area('address','Address'), choice('is_active','Active',['1','0'])
    ]}
  ],
  adoptions: [
    { key: 'adoption_applications', label: 'Adoption Applications', permission: 'adoption:read', writePermission: 'adoption:write', fields: [
      text('application_code','Application code',true), relation('animal_id','Animal record','animals',true), text('applicant_name','Applicant name',true), text('applicant_phone','Phone',true),
      text('applicant_email','Email'), area('applicant_address','Address',true), text('housing_type','Housing type'), choice('has_other_pets','Other pets',['0','1']),
      choice('home_check_status','Home check',['pending','scheduled','passed','failed']), area('home_check_notes','Home check notes'),
      area('experience_notes','Experience')
    ]},
    { key: 'foster_applications', label: 'Foster Applications', permission: 'adoption:read', writePermission: 'adoption:write', fields: [
      text('application_code','Application code',true), relation('animal_id','Animal record','animals',true), text('applicant_name','Applicant name',true), text('applicant_phone','Phone',true),
      text('applicant_email','Email'), area('applicant_address','Address',true), date('foster_start_date','Foster start'), date('expected_end_date','Expected end'), date('actual_end_date','Actual end'), area('notes','Notes')
    ]},
    { key: 'adoption_agreements', label: 'Adoption Agreements & Follow-ups', permission: 'adoption:read', writePermission: 'adoption:write', fields: [
      text('agreement_number','Agreement number',true), relation('application_id','Adoption application','adoption_applications',true), relation('animal_id','Animal record','animals',true), date('handover_date','Handover date',true),
      date('follow_up_30d_date','30-day follow-up'), area('follow_up_30d_notes','30-day notes'), date('follow_up_90d_date','90-day follow-up'), area('follow_up_90d_notes','90-day notes')
    ]}
  ],
  finance: [
    { key: 'donors', label: 'Donor Directory', permission: 'donations:read', writePermission: 'donations:write', fields: [
      text('donor_code','Donor code',true), text('full_name','Donor name',true), text('email','Email'), text('phone','Phone'), text('pan_number','PAN'), area('address','Address'), choice('donor_type','Donor type',['individual','corporate','institutional'])
    ]},
    { key: 'donations', label: 'Donation Register', permission: 'donations:read', writePermission: 'donations:write', fields: [
      relation('donor_id','Donor','donors',true), relation('fund_category_id','Fund category','fund_categories',true), relation('account_id','Receiving account','accounts',true), date('donation_date','Donation date',true),
      num('amount_paise','Amount (₹)',true), choice('payment_mode','Payment mode',['upi','bank_transfer','cash','razorpay','cheque','other'],true), text('transaction_reference','Transaction reference'), area('purpose','Purpose')
    ]},
    { key: 'expenses', label: 'Expense Claims', permission: 'finance:read', writePermission: 'expenses:submit', fields: [
      text('expense_code','Expense code',true), date('expense_date','Expense date',true), choice('category','Category',['animal_food','vet_consultation','medicines','vaccination','sterilization','transportation','rescue_operations','shelter_maintenance','utilities','equipment','administrative','other'],true),
      relation('fund_category_id','Fund category','fund_categories',true), relation('account_id','Payment account','accounts',true), num('amount_paise','Amount (₹)',true), choice('payment_mode','Payment mode',['upi','bank_transfer','cash','card','other'],true),
      text('vendor_payee','Vendor / payee',true), relation('animal_id','Animal','animals'), relation('rescue_case_id','Rescue case','rescue_cases'), area('description','Description',true)
    ]},
    { key: 'financial_transactions', label: 'Immutable Ledger', permission: 'finance:read', fields: [] },
    { key: 'accounts', label: 'Chart of Accounts', permission: 'finance:read', fields: [] },
    { key: 'fund_categories', label: 'Fund Categories', permission: 'finance:read', fields: [] },
    { key: 'compliance_registrations', label: 'Statutory Compliance', permission: 'compliance:read', writePermission: 'compliance:write', fields: [
      choice('reg_type','Registration type',['society_registration','pan','ngo_darpan','12a','80g','awbi','csr1'],true), text('registration_number','Registration number'), text('issuing_authority','Issuing authority',true),
      choice('status','Status',['not_applied','applied','provisional','active','expired','rejected']), date('valid_from','Valid from'), date('valid_until','Valid until'), area('notes','Notes')
    ]}
  ],
  inventory: [
    { key: 'inventory_items', label: 'Stock Catalogue', permission: 'inventory:read', writePermission: 'inventory:write', fields: [
      text('sku','SKU',true), text('name','Item name',true), choice('category','Category',['dog_food','cat_food','medicines','vaccines','supplements','cleaning_supplies','medical_equipment','other'],true),
      choice('unit','Unit',['kg','g','l','ml','tablet','vial','bottle','pack','piece'],true), num('opening_stock','Opening stock'), num('min_stock_threshold','Low-stock threshold'), choice('expiry_tracking_enabled','Track expiry',['0','1']), relation('preferred_supplier_id','Preferred supplier','suppliers')
    ]},
    { key: 'stock_movements', label: 'Stock Movements', permission: 'inventory:read', writePermission: 'inventory:write', fields: [
      relation('item_id','Inventory item','inventory_items',true), choice('movement_type','Movement type',['opening','purchase_in','issue_out','expired_writeoff','adjustment'],true), num('quantity_delta','Quantity change (positive in, negative out)',true),
      text('batch_number','Batch number'), date('expiry_date','Expiry date'), relation('animal_id','Animal','animals'), relation('purchase_order_id','Purchase order','purchase_orders'), area('notes','Notes')
    ]},
    { key: 'suppliers', label: 'Suppliers', permission: 'inventory:read', writePermission: 'inventory:write', fields: [
      text('name','Supplier name',true), text('contact_person','Contact person'), text('phone','Phone'), text('email','Email'), text('gstin','GSTIN'), area('address','Address'), text('category','Category')
    ]},
    { key: 'purchase_orders', label: 'Purchase Orders', permission: 'inventory:read', writePermission: 'inventory:write', fields: [
      text('po_number','PO number',true), relation('supplier_id','Supplier','suppliers',true), date('order_date','Order date',true), choice('status','Status',['draft','ordered','received','cancelled']), num('total_amount_paise','Total amount (₹)'), relation('expense_id','Related expense','expenses')
    ]}
  ],
  volunteers: [
    { key: 'volunteers', label: 'Volunteer & Member Directory', permission: 'volunteers:read', writePermission: 'volunteers:write', fields: [
      text('volunteer_code','Volunteer code',true), text('user_id','Linked ERP user ID (optional)'), text('full_name','Full name',true), text('phone','Phone',true), text('email','Email'), area('address','Address'),
      text('emergency_contact_name','Emergency contact'), text('emergency_contact_phone','Emergency phone'), text('skills_json','Skills (comma-separated)'), text('availability','Availability'),
      choice('role_type','Type',['volunteer','member']), choice('status','Status',['applicant','active','inactive']), date('joined_date','Joined date'), area('notes','Notes')
    ]},
    { key: 'volunteer_tasks', label: 'Tasks & Attendance', permission: 'volunteers:read', writePermission: 'volunteers:write', fields: [
      relation('volunteer_id','Volunteer','volunteers',true), choice('task_type','Task type',['feeding','rescue','shelter_care','medical_assist','event','transport','admin'],true),
      text('title','Task title',true), area('description','Description'), date('scheduled_date','Scheduled date',true), num('hours_logged','Hours logged'), choice('attendance_status','Attendance',['assigned','completed','missed','cancelled'])
    ]}
  ],
  cms: [{ key: 'website_content', label: 'Website Content Drafts', permission: 'cms:read', writePermission: 'cms:write', fields: [
    choice('page_slug','Which website page?',[ 'index.html', 'about.html', 'rescue.html', 'gallery.html', 'adopt.html', 'volunteer.html', 'contact.html', 'donate.html' ],true,{ 'index.html':'Home page', 'about.html':'About us', 'rescue.html':'Animal rescue', 'gallery.html':'Rescue gallery', 'adopt.html':'Adoption', 'volunteer.html':'Volunteer', 'contact.html':'Contact', 'donate.html':'Donate' }),
    choice('section_key','Where should it appear?',[ 'top_of_page', 'after_intro', 'before_bottom_section', 'bottom_of_page' ],true,{ top_of_page:'At the top of the page', after_intro:'Below the introduction', before_bottom_section:'Before the final section', bottom_of_page:'At the bottom of the page' }),
    text('title','Heading visitors will see',true), area('body_json','Text to show on the website',true),
    text('seo_title','Search result title (optional)'), area('seo_description','Short search result description (optional)')
  ]}]
};

const relationDisplay = (resource: string, row: Record<string, unknown>): string => {
  const primary = resource === 'adoption_applications' ? row.application_code
    : resource === 'rescue_cases' ? row.case_code
    : resource === 'purchase_orders' ? row.po_number
    : resource === 'expenses' ? row.expense_code
    : row.name || row.full_name || row.applicant_name || row.title;
  const secondary = resource === 'animals' ? row.animal_code
    : resource === 'volunteers' ? row.volunteer_code
    : resource === 'donors' ? row.donor_code
    : resource === 'fund_categories' || resource === 'accounts' ? row.code
    : resource === 'inventory_items' ? row.sku
    : resource === 'adoption_applications' ? row.applicant_name
    : resource === 'rescue_cases' ? row.location_address
    : resource === 'veterinarians' ? row.clinic_name
    : resource === 'expenses' ? row.vendor_payee
    : '';
  return [primary, secondary].filter(Boolean).map(String).join(' · ') || 'Record';
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
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 100;
  const [relationOptions, setRelationOptions] = useState<Record<string, { value: string; label: string }[]>>({});
  const [form, setForm] = useState<Record<string,string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');
  const [inventoryAlerts, setInventoryAlerts] = useState<{lowStock: Record<string,unknown>[]; expiring: Record<string,unknown>[]; expired: Record<string,unknown>[]} | null>(null);
  const [medicalAlerts, setMedicalAlerts] = useState<{due: Record<string,unknown>[]; overdue: Record<string,unknown>[]} | null>(null);
  const [busy, setBusy] = useState(false);
  const [cmsPreviewOpen, setCmsPreviewOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<Record<string, unknown>[]>([]);
  const [viewingAttachments, setViewingAttachments] = useState<{ id: string; label: string; items: Record<string, unknown>[] } | null>(null);
  const loadRequestId = useRef(0);
  const updateFieldsForResource = (key: string): string[] | null => {
    if (key === 'adoption_applications') return ['experience_notes','home_check_status','home_check_notes'];
    if (key === 'foster_applications') return ['foster_start_date','expected_end_date','actual_end_date','notes'];
    return null;
  };
  const canWrite = !!resource?.writePermission && user.permissions.includes(resource.writePermission);
  const canEdit = canWrite && !['medical_records','vaccinations','donations','expenses','financial_transactions','stock_movements'].includes(resource?.key || '');
  const canViewAttachments = !!resource && user.permissions.includes(resource.permission) && (
    user.roleCode === 'super_admin' ||
    ['animals', 'website_content'].includes(resource.key) ||
    ([
      'rescue_cases', 'medical_records', 'vaccinations', 'adoption_applications',
      'foster_applications', 'adoption_agreements', 'donations', 'expenses',
      'purchase_orders', 'compliance_registrations'
    ].includes(resource.key) && user.permissions.includes('documents:private_read'))
  );
  const canWorkflow = !!resource && ((resource.key === 'donations' && user.permissions.includes('donations:verify')) || (resource.key === 'expenses' && (user.permissions.includes('finance:approve') || user.permissions.includes('finance:ledger'))) || (resource.key === 'stock_movements' && user.permissions.includes('inventory:approve')) || (['adoption_applications','foster_applications'].includes(resource.key) && user.permissions.includes('adoption:approve')));

  const load = async () => {
    if (!resource) return;
    const requestId = ++loadRequestId.current;
    const result = await apiFetch<{ items: Record<string,unknown>[]; total: number }>(`/api/v1/admin/modules/${resource.key}?limit=${pageSize}&offset=${page * pageSize}&q=${encodeURIComponent(search)}`);
    if (requestId !== loadRequestId.current) return;
    if (result.success && result.data) {
      setRows(result.data.items);
      setTotal(result.data.total);
    } else setFeedback(result.error?.message || 'Unable to load records.');
  };

  useEffect(() => { setResourceKey(''); setForm({}); setEditingId(null); setSearch(''); setPage(0); setTotal(0); setFeedback(''); }, [moduleKey]);
  useEffect(() => {
    setInventoryAlerts(null);
    setMedicalAlerts(null);
    if (moduleKey === 'inventory' && user.permissions.includes('inventory:read')) {
      apiFetch<{lowStock: Record<string,unknown>[]; expiring: Record<string,unknown>[]; expired: Record<string,unknown>[]}>( '/api/v1/admin/modules/inventory/alerts')
        .then((res) => { if (res.success && res.data) setInventoryAlerts(res.data); });
    }
    if (moduleKey === 'medical' && user.permissions.includes('medical:read')) {
      apiFetch<{due: Record<string,unknown>[]; overdue: Record<string,unknown>[]}>( '/api/v1/admin/modules/medical/alerts')
        .then((res) => { if (res.success && res.data) setMedicalAlerts(res.data); });
    }
  }, [moduleKey, user.permissions]);
  useEffect(() => {
    let active = true;
    const sources = Array.from(new Set((resource?.fields || []).map((field) => field.relationResource).filter((value): value is string => !!value)));
    if (sources.length === 0) { setRelationOptions({}); return () => { active = false; }; }
    Promise.all(sources.map(async (source) => {
      try {
        const result = await apiFetch<{ items: Record<string, unknown>[] }>(`/api/v1/admin/modules/${source}?limit=200`);
        const options = result.success && result.data ? result.data.items.map((row) => ({ value: String(row.id || ''), label: relationDisplay(source, row) })).filter((item) => item.value) : [];
        return [source, options] as const;
      } catch { return [source, []] as const; }
    })).then((entries) => {
      if (active) setRelationOptions(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, [resource?.key, user.permissions]);
  useEffect(() => { void load(); return () => { loadRequestId.current += 1; }; }, [resourceKey, moduleKey, search, page]);

  const reset = () => { setForm({}); setEditingId(null); setSelectedFiles([]); setAttachments([]); setViewingAttachments(null); };
  const loadAttachments = async (recordId: string) => {
    if (!resource) return;
    const result = await apiFetch<{ items: Record<string, unknown>[] }>(`/api/v1/admin/modules/attachments/${resource.key}/${recordId}`);
    if (result.success && result.data) setAttachments(result.data.items);
  };
  const uploadAttachments = async (recordId: string) => {
    if (!resource || selectedFiles.length === 0) return;
    const publicMedia = ['animals', 'website_content'].includes(resource.key);
    const categories: Record<string, string> = {
      rescue_cases: 'rescue_evidence', medical_records: 'prescription', vaccinations: 'vaccination_cert',
      adoption_applications: 'applicant_id', foster_applications: 'applicant_id', adoption_agreements: 'adoption_agreement',
      donations: 'donor_proof', expenses: 'expense_invoice', inventory_items: 'other',
      purchase_orders: 'purchase_invoice', compliance_registrations: 'compliance_cert',
      stock_movements: 'other', volunteers: 'other', donors: 'other', veterinarians: 'other'
    };
    const filesToUpload = [...selectedFiles];
    for (const file of filesToUpload) {
      const data = new FormData();
      data.append('file', file);
      let uploadedId = '';
      if (publicMedia) {
        data.append('altText', file.name);
        const result = await apiFetch<{ id: string }>('/api/v1/admin/uploads/public-media', { method: 'POST', body: data });
        if (!result.success || !result.data) throw new Error(result.error?.message || `Could not upload ${file.name}`);
        uploadedId = result.data.id;
      } else {
        data.append('docCategory', categories[resource.key] || 'other');
        data.append('title', `${resource.label}: ${file.name}`);
        const result = await apiFetch<{ id: string }>('/api/v1/admin/uploads/private-doc', { method: 'POST', body: data });
        if (!result.success || !result.data) throw new Error(result.error?.message || `Could not upload ${file.name}`);
        uploadedId = result.data.id;
      }
      const linked = await apiFetch<{ id: string }>(`/api/v1/admin/modules/attachments/${resource.key}/${recordId}`, {
        method: 'POST',
        body: JSON.stringify(publicMedia ? { mediaAssetId: uploadedId, label: file.name } : { documentId: uploadedId, label: file.name })
      });
      if (!linked.success) throw new Error(linked.error?.message || `Could not attach ${file.name}`);
      setSelectedFiles((current) => current.filter((pending) => pending !== file));
    }
    await loadAttachments(recordId);
  };
  const showAttachments = async (row: Record<string, unknown>) => {
    if (!resource) return;
    const id = String(row.id || '');
    const label = String(row.name || row.animal_code || row.case_code || row.application_code || row.full_name || row.applicant_name || row.sku || id);
    setViewingAttachments({ id, label, items: [] });
    const result = await apiFetch<{ items: Record<string, unknown>[] }>(`/api/v1/admin/modules/attachments/${resource.key}/${id}`);
    if (result.success && result.data) setViewingAttachments({ id, label, items: result.data.items });
    else setFeedback(result.error?.message || 'Unable to load attachments.');
  };
  const openPrivateAttachment = async (documentId: string) => {
    const popup = window.open('about:blank', '_blank');
    const result = await apiFetch<{ url: string }>(`/api/v1/admin/documents/${documentId}/signed-url`);
    if (result.success && result.data?.url && popup) {
      popup.opener = null;
      popup.location.href = result.data.url;
    } else {
      popup?.close();
      setFeedback(result.error?.message || 'Unable to open this private file. Allow pop-ups and try again.');
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resource) return;
    setBusy(true); setFeedback('');
    const payload: Record<string,string|number|boolean|null> = {};
    const updateFields: Record<string, string[]> = {
      adoption_applications: ['experience_notes','home_check_status','home_check_notes'],
      foster_applications: ['foster_start_date','expected_end_date','actual_end_date','notes']
    };
    for (const field of resource.fields) {
      if (editingId && updateFields[resource.key] && !updateFields[resource.key].includes(field.key)) continue;
      if (editingId && resource.key === 'inventory_items' && field.key === 'opening_stock') continue;
      const value = form[field.key];
      if (value === undefined || value === '') continue;
      if (field.key === 'body_json' && resource.key === 'website_content') payload.body_json = JSON.stringify({ content: value });
      else if (field.key === 'skills_json' && resource.key === 'volunteers') payload.skills_json = JSON.stringify(value.split(',').map((item) => item.trim()).filter(Boolean));
      else if (field.type === 'number' && ['amount_paise','total_amount_paise'].includes(field.key)) payload[field.key] = Math.round(Number(value) * 100);
      else if (field.type === 'number') payload[field.key] = Number(value);
      else if (field.key.startsWith('is_') || field.key === 'has_other_pets' || field.key === 'expiry_tracking_enabled') payload[field.key] = value === '1';
      else payload[field.key] = value;
    }
    const result = editingId && Object.keys(payload).length === 0 && selectedFiles.length > 0
      ? { success: true, data: { id: editingId } }
      : await apiFetch<{ id?: string }>(editingId ? `/api/v1/admin/modules/${resource.key}/${editingId}` : `/api/v1/admin/modules/${resource.key}`, {
          method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(payload)
        });
    if (result.success) {
      const savedId = editingId || result.data?.id;
      if (savedId && selectedFiles.length) {
        setEditingId(savedId);
        try {
          const count = selectedFiles.length;
          await uploadAttachments(savedId);
          setFeedback(`Record saved and ${count} file(s) uploaded.`);
          reset();
        } catch (error) {
          setFeedback(`Record saved, but an attachment failed: ${error instanceof Error ? error.message : 'Upload error'}. Your selected files remain available; retry Save changes.`);
        }
      } else {
        setFeedback(editingId ? 'Record updated.' : 'Record created.');
        reset();
      }
      await load();
    } else setFeedback(result.error?.message || 'Save failed.');
    setBusy(false);
  };

  const beginEdit = (row: Record<string,unknown>) => {
    if (!resource) return;
    const id = String(row.id || '');
    const next: Record<string,string> = {};
    for (const field of resource.fields) {
      const value = row[field.key];
      if (value !== null && value !== undefined) {
        if (field.key === 'body_json' && resource.key === 'website_content') {
          try {
            const parsed = JSON.parse(String(value)) as { content?: unknown };
            next[field.key] = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed, null, 2);
          } catch { next[field.key] = String(value); }
        } else if (field.key === 'skills_json' && resource.key === 'volunteers') {
          try { const parsed = JSON.parse(String(value)); next[field.key] = Array.isArray(parsed) ? parsed.join(', ') : String(value); }
          catch { next[field.key] = String(value); }
        } else if (['amount_paise','total_amount_paise'].includes(field.key)) {
          next[field.key] = (Number(value) / 100).toFixed(2);
        } else next[field.key] = String(value);
      }
    }
    setForm(next); setEditingId(id); void loadAttachments(id);
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
  if (resource?.key === 'inventory_items') columns.push('current_stock');
  if (resource?.key === 'adoption_applications' || resource?.key === 'foster_applications') columns.push('status');

  if (resource && !columns.includes('id')) columns.unshift('id');

  return <div className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-wider text-orange-700">Paw&apos;s Hopez Society · NGO ERP</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">{TITLES[moduleKey] || 'ERP Module'}</h1><p className="mt-1 text-sm text-slate-600">Operational records, workflows and history.</p></div>
      <div className="sm:w-72"><label className="mb-1 block text-xs font-bold uppercase text-slate-500">Workspace</label><select value={resource?.key || ''} onChange={(e) => { setResourceKey(e.target.value); setPage(0); setTotal(0); reset(); }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">{available.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
    </header>
    {feedback && <div role="status" className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">{feedback}</div>}
    {moduleKey === 'inventory' && inventoryAlerts && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Inventory alerts</strong><p className="mt-1">Low stock: {inventoryAlerts.lowStock.length} · Expired batches: {inventoryAlerts.expired.length} · Expiring in 30 days: {inventoryAlerts.expiring.length}</p></section>}
    {moduleKey === 'medical' && medicalAlerts && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Vaccination reminders</strong><p className="mt-1">Overdue: {medicalAlerts.overdue.length} · Due within 30 days: {medicalAlerts.due.length}</p></section>}
    {canWrite && resource && resource.fields.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-slate-900">{editingId ? 'Update record' : `Add ${resource.label}`}</h2>{editingId && <button type="button" onClick={reset} className="text-sm font-semibold text-slate-600 underline">Cancel edit</button>}</div>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {resource.fields.map((field) => <label key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}><span className="mb-1 block text-xs font-bold text-slate-600">{field.label}{field.required ? ' *' : ''}</span>{resource.key === 'website_content' && field.key === 'page_slug' && <span className="mb-2 block text-xs font-normal text-slate-500">Choose the existing website page where this update belongs.</span>}{resource.key === 'website_content' && field.key === 'section_key' && <span className="mb-2 block text-xs font-normal text-slate-500">Top = first on page; After introduction = below opening text; Before bottom section = near the end; Bottom = last on page.</span>}
          {field.type === 'textarea' ? <><textarea disabled={!!editingId && !!updateFieldsForResource(resource?.key || '') && !updateFieldsForResource(resource?.key || '')!.includes(field.key)} required={field.required} value={form[field.key] || ''} onChange={(e) => setForm((v) => ({...v,[field.key]:e.target.value}))} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />{resource.key === 'website_content' && field.key === 'body_json' && <span className="mt-1 block text-xs font-normal text-slate-500">Write normal sentences or short paragraphs. Do not enter code, HTML or JSON. This is the text visitors will read.</span>}</>
          : field.type === 'select' && field.relationResource && (relationOptions[field.relationResource] || []).length === 0 ? <input disabled={!!editingId && !!updateFieldsForResource(resource?.key || '') && !updateFieldsForResource(resource?.key || '')!.includes(field.key)} required={field.required} type="text" placeholder="Enter existing record ID" value={form[field.key] || ''} onChange={(e) => setForm((v) => ({...v,[field.key]:e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          : field.type === 'select' ? <select disabled={!!editingId && !!updateFieldsForResource(resource?.key || '') && !updateFieldsForResource(resource?.key || '')!.includes(field.key) || !!editingId && resource?.key === 'inventory_items' && field.key === 'opening_stock'} required={field.required} value={form[field.key] || ''} onChange={(e) => setForm((v) => ({...v,[field.key]:e.target.value}))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">{field.relationResource ? 'Choose a linked record…' : 'Select…'}</option>{field.relationResource ? relationOptions[field.relationResource]?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>) : field.options?.map((option) => <option key={option} value={option}>{field.optionLabels?.[option] || option.replaceAll('_',' ')}</option>)}</select>
          : <input disabled={!!editingId && !!updateFieldsForResource(resource?.key || '') && !updateFieldsForResource(resource?.key || '')!.includes(field.key) || !!editingId && resource?.key === 'inventory_items' && field.key === 'opening_stock'} required={field.required} type={field.type || 'text'} min={field.type === 'number' && field.key !== 'quantity_delta' ? 0 : undefined} step={field.type === 'number' ? 'any' : undefined} value={form[field.key] || ''} onChange={(e) => setForm((v) => ({...v,[field.key]:e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />}
        </label>)}
        <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <label className="block text-sm font-semibold text-slate-800">Photos and documents (optional)</label>
          <p className="mt-1 text-xs text-slate-600">{['animals', 'website_content'].includes(resource?.key || '') ? 'Choose JPG, PNG or WebP images. Maximum 10 MB per file.' : 'Choose JPG, PNG, WebP images or PDF files. Maximum 10 MB per file.'} Files are stored in R2 and linked to this record after saving.</p>
          <input type="file" multiple accept={['animals', 'website_content'].includes(resource?.key || '') ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'} onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} className="mt-3 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-100 file:px-3 file:py-2 file:font-semibold file:text-orange-800" />
          {selectedFiles.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">{selectedFiles.map((file, index) => <li key={index}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>)}</ul>}
          {attachments.length > 0 && <div className="mt-3 border-t border-slate-200 pt-3"><p className="mb-2 text-xs font-bold text-slate-700">Already attached</p><ul className="space-y-1">{attachments.map((item) => <li key={String(item.id)} className="flex flex-wrap items-center gap-2 text-xs">
            {item.public_url ? <a className="text-blue-700 underline" href={String(item.public_url)} target="_blank" rel="noreferrer">{String(item.media_file_name || item.label || 'Open image')}</a> : <button type="button" className="text-blue-700 underline" onClick={() => void openPrivateAttachment(String(item.document_id))}>{String(item.document_file_name || item.label || 'Open private document')}</button>}
            <span className="text-slate-500">{String(item.doc_category || item.media_mime_type || item.document_mime_type || '')}</span>
          </li>)}</ul></div>}
        </div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-3">{resource.key === 'website_content' && <button type="button" onClick={() => setCmsPreviewOpen(true)} className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Preview content</button>}<button disabled={busy} className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create record'}</button></div>
      </form>
    </section>}
    {viewingAttachments && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="font-bold text-slate-900">Files: {viewingAttachments.label}</h2><p className="text-xs text-slate-500">{viewingAttachments.items.length} attachment(s)</p></div>
        <button type="button" onClick={() => setViewingAttachments(null)} className="text-sm font-semibold text-slate-600 underline">Close</button>
      </div>
      {viewingAttachments.items.length === 0 ? <p className="mt-3 text-sm text-slate-500">No files attached to this record yet.</p> : <ul className="mt-3 space-y-2">{viewingAttachments.items.map((item) => <li key={String(item.id)} className="flex flex-wrap items-center gap-2 text-sm">
        {item.public_url ? <a className="text-blue-700 underline" href={String(item.public_url)} target="_blank" rel="noreferrer">{String(item.media_file_name || item.label || 'Open image')}</a> : <button type="button" className="text-blue-700 underline" onClick={() => void openPrivateAttachment(String(item.document_id))}>{String(item.document_file_name || item.label || 'Open private document')}</button>}
        <span className="text-xs text-slate-500">{String(item.doc_category || item.media_mime_type || item.document_mime_type || '')}</span>
      </li>)}</ul>}
    </section>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">{resource?.label}</h2><p className="text-xs text-slate-500">{total} matching record(s) · showing up to {pageSize} per page</p></div><input value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} placeholder="Search records…" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64" /></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{columns.map((col) => <th key={col} className="px-4 py-3">{col.replaceAll('_',' ')}</th>)}{(canEdit || canWorkflow || canViewAttachments) && <th className="px-4 py-3 text-right">Action</th>}</tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={columns.length + (canEdit || canWorkflow || canViewAttachments ? 1 : 0)} className="px-4 py-10 text-center text-slate-500">No records found.</td></tr> : rows.map((row) => <tr key={String(row.id)}>{columns.map((col) => <td key={col} className="max-w-xs truncate px-4 py-3 text-slate-700">{row[col] === null || row[col] === undefined ? '—' : ['amount_paise','total_amount_paise'].includes(col) ? `₹${(Number(row[col]) / 100).toFixed(2)}` : String(row[col])}</td>)}{(canEdit || canWorkflow || canViewAttachments) && <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2">{canViewAttachments && <button type="button" onClick={() => void showAttachments(row)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Files</button>}{canEdit && !(resource?.key === 'website_content' && row.status === 'published') && <button type="button" onClick={() => beginEdit(row)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Edit</button>}{actionsForRow(row).map((action) => <button key={action} type="button" onClick={() => void runWorkflow(action,row)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold capitalize text-white hover:bg-slate-700">{action === 'paid' ? 'Mark paid' : action === 'verify' ? 'Verify' : action}</button>)}</div></td>}</tr>)}</tbody></table></div>
    </section>
    {cmsPreviewOpen && resource?.key === 'website_content' && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cms-preview-title">
      <section className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div><h2 id="cms-preview-title" className="font-bold text-slate-900">Website content preview</h2><p className="text-xs text-slate-500">Draft preview · Nothing has been published or changed on the public website</p></div>
          <button type="button" onClick={() => setCmsPreviewOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Close preview</button>
        </header>
        <div className="overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white"><span className="font-bold">Paw&apos;s Hopez Society</span><span className="text-xs text-slate-300">Let Them Know... Someone Cares.</span></div>
            <div className="border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{String(form.page_slug || 'index.html').replace('.html','').replaceAll('_',' ')} page</div>
            <div className="min-h-[300px] px-5 py-8 sm:px-10">
              {form.section_key === 'top_of_page' && <article className="mb-8 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 p-5"><span className="mb-2 inline-block text-[10px] font-bold uppercase tracking-wider text-orange-700">Your draft · Top of page</span><h1 className="text-2xl font-extrabold text-slate-900">{form.title || 'Your heading will appear here'}</h1><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{form.body_json || 'Your website text will appear here.'}</p></article>}
              <div className="rounded-lg bg-slate-50 p-5"><h3 className="text-lg font-bold text-slate-800">Website page content</h3><p className="mt-2 text-sm leading-7 text-slate-600">This area represents the existing content on the selected page. The draft section is highlighted so you can review its wording and placement.</p></div>
              {form.section_key !== 'top_of_page' && <article className="my-8 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 p-5"><span className="mb-2 inline-block text-[10px] font-bold uppercase tracking-wider text-orange-700">Your draft · {String(form.section_key || 'after_intro').replaceAll('_',' ')}</span><h2 className="text-xl font-extrabold text-slate-900">{form.title || 'Your heading will appear here'}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{form.body_json || 'Your website text will appear here.'}</p></article>}
            </div>
            <footer className="bg-slate-900 px-5 py-4 text-xs text-slate-300">Paw&apos;s Hopez Society · Public website preview</footer>
          </div>
          <p className="mx-auto mt-4 max-w-4xl text-xs text-slate-500">This is a content-and-placement preview inside the ERP, not a pixel-perfect rendering of the selected live page. Save your draft to keep it; publishing to the public website is a separate feature that is not connected yet.</p>
        </div>
      </section>
    </div>}
    <p className="text-xs text-slate-500">Financial ledger entries and medical/vaccination records are append-only in this workspace. Financial approval, payment, statutory receipt issuance and live CMS publishing require their dedicated controlled workflows before production use.</p>
  </div>;
};
