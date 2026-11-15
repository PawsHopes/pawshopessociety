import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../../types/env';
import { appendAuditLog } from '../../services/audit';

type ResourceConfig = {
  table: string;
  read: string;
  write?: string;
  fields: string[];
  required?: string[];
  search: string[];
  order: string;
  defaults?: Record<string, string | number>;
  serverFields?: (actorId: string) => Record<string, string>;
  immutable?: boolean;
  updateFields?: string[];
};

const RESOURCES: Record<string, ResourceConfig> = {
  animals: {
    table: 'animals', read: 'animals:read', write: 'animals:write',
    fields: ['animal_code','legacy_slug','name','species','breed','gender','estimated_age_text','estimated_dob','identification_marks','microchip_or_tag','rescue_date','rescue_location','rescue_source','rescue_case_id','health_summary','vaccination_status','sterilization_status','sterilization_date','kennel_zone','caretaker_user_id','is_adoption_eligible','is_foster_eligible','is_published_public','public_description','adopted_note','internal_notes','current_status'],
    required: ['animal_code','name','species'], search: ['animal_code','name','breed','microchip_or_tag'], order: 'created_at',
    defaults: { gender: 'Unknown', vaccination_status: 'pending', sterilization_status: 'not_sterilized', is_adoption_eligible: 0, is_foster_eligible: 0, is_published_public: 0, current_status: 'rescued' },
  },
  rescue_cases: {
    table: 'rescue_cases', read: 'rescue:read', write: 'rescue:write',
    fields: ['case_code','reporter_name','reporter_phone','reporter_email','location_address','latitude','longitude','species','animal_description','complaint_details','priority','status','outcome_notes','assigned_volunteer_id','rescue_team_notes'],
    required: ['case_code','reporter_name','reporter_phone','location_address','animal_description','complaint_details'], search: ['case_code','reporter_name','reporter_phone','location_address','animal_description'], order: 'reported_at',
    defaults: { species: 'Dog', priority: 'medium', status: 'new' },
  },
  medical_records: {
    table: 'medical_records', read: 'medical:read', write: 'medical:write',
    fields: ['animal_id','veterinarian_id','visit_date','record_type','symptoms','diagnosis','prescription_text','medication_history_notes','treatment_notes','follow_up_date','attachment_doc_id'],
    required: ['animal_id','visit_date','record_type','diagnosis'], search: ['diagnosis','symptoms','prescription_text'], order: 'visit_date',
    serverFields: (actorId) => ({ created_by: actorId }), immutable: true,
  },
  vaccinations: {
    table: 'vaccinations', read: 'medical:read', write: 'medical:write',
    fields: ['animal_id','vaccine_name','batch_number','administered_date','next_due_date','veterinarian_id','certificate_doc_id','notes'],
    required: ['animal_id','vaccine_name','administered_date'], search: ['vaccine_name','batch_number'], order: 'administered_date',
    serverFields: (actorId) => ({ created_by: actorId }), immutable: true,
  },
  veterinarians: {
    table: 'veterinarians', read: 'medical:read', write: 'medical:write',
    fields: ['name','clinic_name','registration_number','phone','email','address','is_active'],
    required: ['name'], search: ['name','clinic_name','phone','registration_number'], order: 'created_at',
    defaults: { is_active: 1 },
  },
  adoption_applications: {
    table: 'adoption_applications', read: 'adoption:read', write: 'adoption:write',
    fields: ['application_code','animal_id','applicant_name','applicant_phone','applicant_email','applicant_address','housing_type','has_other_pets','experience_notes','home_check_status','home_check_notes','status','rejection_reason'],
    required: ['application_code','animal_id','applicant_name','applicant_phone','applicant_address'], search: ['application_code','applicant_name','applicant_phone','applicant_email'], order: 'created_at',
    defaults: { has_other_pets: 0, home_check_status: 'pending', status: 'application' },
  },
  foster_applications: {
    table: 'foster_applications', read: 'adoption:read', write: 'adoption:write',
    fields: ['application_code','animal_id','applicant_name','applicant_phone','applicant_email','applicant_address','foster_start_date','expected_end_date','actual_end_date','notes','status'],
    required: ['application_code','animal_id','applicant_name','applicant_phone','applicant_address'], search: ['application_code','applicant_name','applicant_phone','applicant_email'], order: 'created_at',
    defaults: { status: 'application' },
  },
  adoption_agreements: {
    table: 'adoption_agreements', read: 'adoption:read', write: 'adoption:write',
    fields: ['agreement_number','application_id','animal_id','handover_date','signed_agreement_doc_id','handover_doc_id','follow_up_30d_date','follow_up_30d_notes','follow_up_90d_date','follow_up_90d_notes'],
    required: ['agreement_number','application_id','animal_id','handover_date'], search: ['agreement_number'], order: 'created_at',
    serverFields: (actorId) => ({ witnessed_by: actorId }),
  },
  donors: {
    table: 'donors', read: 'donations:read', write: 'donations:write',
    fields: ['donor_code','full_name','email','phone','pan_number','address','donor_type'],
    required: ['donor_code','full_name'], search: ['donor_code','full_name','email','phone'], order: 'created_at',
    defaults: { donor_type: 'individual' },
  },
  donations: {
    table: 'donations', read: 'donations:read', write: 'donations:write',
    fields: ['donor_id','fund_category_id','account_id','donation_date','amount_paise','payment_mode','transaction_reference','purpose','proof_doc_id'],
    required: ['donor_id','fund_category_id','account_id','donation_date','amount_paise','payment_mode'], search: ['transaction_reference','purpose'], order: 'donation_date',
    defaults: { verification_status: 'pending' }, immutable: true,
  },
  expenses: {
    table: 'expenses', read: 'finance:read', write: 'expenses:submit',
    fields: ['expense_code','expense_date','category','fund_category_id','account_id','description','amount_paise','payment_mode','vendor_payee','animal_id','rescue_case_id','invoice_doc_id'],
    required: ['expense_code','expense_date','category','fund_category_id','account_id','amount_paise','payment_mode'], search: ['expense_code','description','vendor_payee'], order: 'expense_date',
    defaults: { approval_status: 'pending', payment_status: 'unpaid' },
    serverFields: (actorId) => ({ submitted_by: actorId }),
    updateFields: [],
  },
  financial_transactions: {
    table: 'financial_transactions', read: 'finance:read',
    fields: [], search: ['txn_number','narration','reference_type','reference_id'], order: 'txn_date', immutable: true,
  },
  accounts: {
    table: 'accounts', read: 'finance:read', fields: [], search: ['code','name'], order: 'code', immutable: true,
  },
  fund_categories: {
    table: 'fund_categories', read: 'finance:read', fields: [], search: ['code','name'], order: 'name', immutable: true,
  },
  compliance_registrations: {
    table: 'compliance_registrations', read: 'compliance:read', write: 'compliance:write',
    fields: ['reg_type','registration_number','issuing_authority','status','valid_from','valid_until','certificate_doc_id','notes'],
    required: ['reg_type','issuing_authority'], search: ['reg_type','registration_number','issuing_authority'], order: 'reg_type',
    serverFields: (actorId) => ({ updated_by: actorId }),
  },
  inventory_items: {
    table: 'inventory_items', read: 'inventory:read', write: 'inventory:write',
    fields: ['sku','name','category','unit','opening_stock','current_stock','min_stock_threshold','expiry_tracking_enabled','preferred_supplier_id'],
    required: ['sku','name','category','unit'], search: ['sku','name','category'], order: 'name',
    defaults: { opening_stock: 0, current_stock: 0, min_stock_threshold: 0, expiry_tracking_enabled: 0 },
  },
  stock_movements: {
    table: 'stock_movements', read: 'inventory:read', write: 'inventory:write',
    fields: ['item_id','movement_type','quantity_delta','batch_number','expiry_date','animal_id','purchase_order_id','notes'],
    required: ['item_id','movement_type','quantity_delta'], search: ['batch_number','notes'], order: 'created_at',
    defaults: { approval_status: 'pending' }, serverFields: (actorId) => ({ recorded_by: actorId }), immutable: true,
  },
  suppliers: {
    table: 'suppliers', read: 'inventory:read', write: 'inventory:write',
    fields: ['name','contact_person','phone','email','gstin','address','category'],
    required: ['name'], search: ['name','contact_person','phone','gstin'], order: 'name',
  },
  purchase_orders: {
    table: 'purchase_orders', read: 'inventory:read', write: 'inventory:write',
    fields: ['po_number','supplier_id','order_date','status','total_amount_paise','invoice_doc_id','expense_id'],
    required: ['po_number','supplier_id','order_date'], search: ['po_number'], order: 'order_date',
    defaults: { status: 'draft' }, serverFields: (actorId) => ({ created_by: actorId }),
  },
  volunteers: {
    table: 'volunteers', read: 'volunteers:read', write: 'volunteers:write',
    fields: ['volunteer_code','user_id','full_name','phone','email','address','emergency_contact_name','emergency_contact_phone','skills_json','availability','role_type','status','joined_date','notes'],
    required: ['volunteer_code','full_name','phone'], search: ['volunteer_code','full_name','phone','email'], order: 'created_at',
    defaults: { skills_json: '[]', role_type: 'volunteer', status: 'applicant' },
  },
  volunteer_tasks: {
    table: 'volunteer_tasks', read: 'volunteers:read', write: 'volunteers:write',
    fields: ['volunteer_id','task_type','title','description','scheduled_date','hours_logged','attendance_status'],
    required: ['volunteer_id','task_type','title','scheduled_date'], search: ['title','description'], order: 'scheduled_date',
    defaults: { hours_logged: 0, attendance_status: 'assigned' }, serverFields: (actorId) => ({ assigned_by: actorId }),
  },
  website_content: {
    table: 'website_content', read: 'cms:read', write: 'cms:write',
    fields: ['page_slug','section_key','title','body_json','media_asset_id','seo_title','seo_description','status'],
    required: ['page_slug','section_key','title','body_json'], search: ['page_slug','section_key','title'], order: 'updated_at',
    defaults: { status: 'draft', version_number: 1 }, serverFields: (actorId) => ({ updated_by: actorId }),
  },
};

export const adminModuleRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

adminModuleRoutes.get('/:resource', async (c) => {
  const resource = c.req.param('resource');
  const config = RESOURCES[resource];
  const actor = c.get('authUser');
  if (!config) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown ERP resource.' } }, 404);
  if (!actor.permissions.includes(config.read)) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view this resource.' } }, 403);

  const limit = Math.min(Math.max(Number(c.req.query('limit') || 50) || 50, 1), 200);
  const search = (c.req.query('q') || '').trim().slice(0, 100);
  let sql = `SELECT * FROM ${config.table}`;
  const params: unknown[] = [];
  if (search && config.search.length) {
    sql += ' WHERE (' + config.search.map((col) => `${col} LIKE ?`).join(' OR ') + ')';
    for (let i = 0; i < config.search.length; i++) params.push(`%${search}%`);
  }
  sql += ` ORDER BY ${config.order} DESC LIMIT ?`;
  params.push(limit);
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ success: true, data: { items: result.results || [], resource, readOnly: !config.write || config.immutable === true } });
});

adminModuleRoutes.post('/:resource', async (c) => {
  const resource = c.req.param('resource');
  const config = RESOURCES[resource];
  const actor = c.get('authUser');
  if (!config) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown ERP resource.' } }, 404);
  if (!config.write || !actor.permissions.includes(config.write)) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create records here.' } }, 403);
  const body = await c.req.json().catch(() => null);
  const parsed = zRecord(body);
  if (!parsed.ok) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Send a JSON object containing only text, numbers, booleans or null values.' } }, 400);
  const input = parsed.value;
  const invalid = Object.keys(input).filter((key) => !config.fields.includes(key));
  if (invalid.length) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Unsupported fields: ${invalid.join(', ')}` } }, 400);
  const missing = (config.required || []).filter((key) => input[key] === undefined || input[key] === null || input[key] === '');
  if (missing.length) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Required fields missing: ${missing.join(', ')}` } }, 400);

  const values: Record<string, unknown> = { ...(config.defaults || {}), ...input, ...(config.serverFields?.(actor.id) || {}) };
  if (resource === 'donations') values.verification_status = 'pending';
  if (resource === 'expenses') values.approval_status = 'pending';
  if (resource === 'website_content') values.status = 'draft';
  if (resource === 'stock_movements') values.approval_status = 'pending';
  const id = crypto.randomUUID();
  const columns = ['id', ...Object.keys(values)];
  const placeholders = columns.map(() => '?').join(', ');
  const bindings = [id, ...Object.values(values)];
  await c.env.DB.prepare(`INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders})`).bind(...bindings).run();
  await appendAuditLog(c, { action: `${resource.toUpperCase()}_CREATED`, entityType: resource, entityId: id, after: values });
  return c.json({ success: true, data: { id, created: true } }, 201);
});

adminModuleRoutes.patch('/:resource/:id', async (c) => {
  const resource = c.req.param('resource');
  const config = RESOURCES[resource];
  const actor = c.get('authUser');
  if (!config) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown ERP resource.' } }, 404);
  if (!config.write || !actor.permissions.includes(config.write)) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to update records here.' } }, 403);
  if (config.immutable) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'This record type is append-only. Create a new record or use its approval workflow.' } }, 403);
  const body = await c.req.json().catch(() => null);
  const parsed = zRecord(body);
  if (!parsed.ok || Object.keys(parsed.value).length === 0) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Provide at least one valid field.' } }, 400);
  const editable = config.updateFields ?? config.fields;
  const keys = Object.keys(parsed.value);
  const invalid = keys.filter((key) => !editable.includes(key));
  if (invalid.length) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Fields cannot be updated: ${invalid.join(', ')}` } }, 400);
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Record not found.' } }, 404);
  const setClause = keys.map((key) => `${key} = ?`).join(', ');
  await c.env.DB.prepare(`UPDATE ${config.table} SET ${setClause}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).bind(...keys.map((key) => parsed.value[key]), id).run();
  if (resource === 'animals' && parsed.value.current_status !== undefined && parsed.value.current_status !== existing.current_status) {
    await c.env.DB.prepare('INSERT INTO animal_status_history (id, animal_id, from_status, to_status, reason, changed_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), id, existing.current_status ?? null, parsed.value.current_status, 'Status updated in Admin ERP', actor.id).run();
  }
  if (resource === 'rescue_cases' && parsed.value.status !== undefined && parsed.value.status !== existing.status) {
    await c.env.DB.prepare('INSERT INTO rescue_case_updates (id, rescue_case_id, from_status, to_status, note, updated_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), id, existing.status ?? null, parsed.value.status, 'Status updated in Admin ERP', actor.id).run();
  }
  await appendAuditLog(c, { action: `${resource.toUpperCase()}_UPDATED`, entityType: resource, entityId: id, before: existing, after: parsed.value });
  return c.json({ success: true, data: { id, updated: true } });
});

function zRecord(value: unknown): { ok: true; value: Record<string, string | number | boolean | null> } | { ok: false } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false };
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 40) return { ok: false };
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of entries) {
    if (!/^[a-z_]{1,64}$/.test(key)) return { ok: false };
    if (item === null) out[key] = item;
    else if (typeof item === 'boolean') out[key] = item ? 1 : 0;
    else if (typeof item === 'string' && item.length <= 10000) out[key] = item;
    else if (typeof item === 'number' && Number.isFinite(item)) out[key] = item;
    else return { ok: false };
  }
  return { ok: true, value: out };
}
