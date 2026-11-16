import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../../types/env';
import { appendAuditLog } from '../../services/audit';
import { canReadDocumentCategory } from '../../services/documentAccess';

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
    fields: ['animal_code','legacy_slug','name','species','breed','gender','estimated_age_text','estimated_dob','identification_marks','microchip_or_tag','rescue_date','rescue_location','rescue_source','rescue_case_id','health_summary','vaccination_status','sterilization_status','sterilization_date','kennel_zone','caretaker_user_id','is_adoption_eligible','is_foster_eligible','public_description','adopted_note','internal_notes','current_status'],
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
    fields: ['application_code','animal_id','applicant_name','applicant_phone','applicant_email','applicant_address','housing_type','has_other_pets','experience_notes','home_check_status','home_check_notes','rejection_reason'],
    required: ['application_code','animal_id','applicant_name','applicant_phone','applicant_address'], search: ['application_code','applicant_name','applicant_phone','applicant_email'], order: 'created_at',
    defaults: { has_other_pets: 0, home_check_status: 'pending', status: 'application' },
    updateFields: ['experience_notes','home_check_status','home_check_notes'],
  },
  foster_applications: {
    table: 'foster_applications', read: 'adoption:read', write: 'adoption:write',
    fields: ['application_code','animal_id','applicant_name','applicant_phone','applicant_email','applicant_address','foster_start_date','expected_end_date','actual_end_date','notes'],
    required: ['application_code','animal_id','applicant_name','applicant_phone','applicant_address'], search: ['application_code','applicant_name','applicant_phone','applicant_email'], order: 'created_at',
    defaults: { status: 'application' }, updateFields: ['foster_start_date','expected_end_date','actual_end_date','notes'],
  },
  adoption_agreements: {
    table: 'adoption_agreements', read: 'adoption:read', write: 'adoption:write',
    fields: ['agreement_number','application_id','animal_id','handover_date','signed_agreement_doc_id','handover_doc_id','follow_up_30d_date','follow_up_30d_notes','follow_up_90d_date','follow_up_90d_notes'],
    required: ['agreement_number','application_id','animal_id','handover_date'], search: ['agreement_number'], order: 'created_at',
    serverFields: (actorId) => ({ witnessed_by: actorId }),
    updateFields: ['follow_up_30d_date','follow_up_30d_notes','follow_up_90d_date','follow_up_90d_notes'],
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
  donation_receipts: {
    table: 'donation_receipts', read: 'donations:read',
    fields: [], search: ['receipt_number'], order: 'issued_date', immutable: true,
  },
  expenses: {
    table: 'expenses', read: 'finance:read', write: 'expenses:submit',
    fields: ['expense_code','expense_date','category','fund_category_id','account_id','description','amount_paise','payment_mode','vendor_payee','animal_id','rescue_case_id','invoice_doc_id'],
    required: ['expense_code','expense_date','category','fund_category_id','account_id','description','amount_paise','payment_mode','vendor_payee'], search: ['expense_code','description','vendor_payee'], order: 'expense_date',
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
    fields: ['sku','name','category','unit','opening_stock','min_stock_threshold','expiry_tracking_enabled','preferred_supplier_id'],
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
    // Publishing status is server-controlled; only a dedicated publishing workflow may change it.
    updateFields: ['page_slug','section_key','title','body_json','media_asset_id','seo_title','seo_description'],
  },
};

export const adminModuleRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

const ATTACHMENT_RESOURCES = new Set(Object.keys(RESOURCES));

adminModuleRoutes.get('/attachments/:resource/:recordId', async (c) => {
  const resource = c.req.param('resource');
  const recordId = c.req.param('recordId');
  const config = RESOURCES[resource];
  const actor = c.get('authUser');
  if (!config || !ATTACHMENT_RESOURCES.has(resource)) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown ERP resource.' } }, 404);
  if (!actor.permissions.includes(config.read)) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view these attachments.' } }, 403);
  const record = await c.env.DB.prepare(`SELECT id FROM ${config.table} WHERE id = ?`).bind(recordId).first<{id:string}>();
  if (!record) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'ERP record not found.' } }, 404);
  const result = await c.env.DB.prepare(`
    SELECT ra.id, ra.resource, ra.record_id, ra.media_asset_id, ra.document_id, ra.label, ra.created_at,
      ma.public_url, ma.file_name AS media_file_name, ma.mime_type AS media_mime_type,
      d.title AS document_title, d.file_name AS document_file_name, d.mime_type AS document_mime_type,
      d.doc_category
    FROM record_attachments ra
    LEFT JOIN media_assets ma ON ma.id = ra.media_asset_id
    LEFT JOIN documents d ON d.id = ra.document_id
    WHERE ra.resource = ? AND ra.record_id = ?
    ORDER BY ra.created_at DESC
  `).bind(resource, recordId).all();
  const items = (result.results || []).filter((item) =>
    !item.document_id || canReadDocumentCategory(actor, String(item.doc_category || 'other'))
  );
  return c.json({ success: true, data: { items } });
});

adminModuleRoutes.post('/attachments/:resource/:recordId', async (c) => {
  const resource = c.req.param('resource');
  const recordId = c.req.param('recordId');
  const config = RESOURCES[resource];
  const actor = c.get('authUser');
  if (!config) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown ERP resource.' } }, 404);
  if (!config.write || !actor.permissions.includes(config.write)) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to attach files to this record.' } }, 403);
  const body = await c.req.json().catch(() => null) as { mediaAssetId?: unknown; documentId?: unknown; label?: unknown } | null;
  const mediaAssetId = typeof body?.mediaAssetId === 'string' ? body.mediaAssetId : '';
  const documentId = typeof body?.documentId === 'string' ? body.documentId : '';
  if (!!mediaAssetId === !!documentId) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Provide exactly one uploaded image or private document ID.' } }, 400);
  const record = await c.env.DB.prepare(`SELECT id FROM ${config.table} WHERE id = ?`).bind(recordId).first<{id:string}>();
  if (!record) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Save the ERP record before attaching files.' } }, 404);

  if (mediaAssetId) {
    const asset = await c.env.DB.prepare('SELECT id, uploaded_by FROM media_assets WHERE id = ?').bind(mediaAssetId).first<{id:string;uploaded_by:string|null}>();
    if (!asset || (asset.uploaded_by !== actor.id && actor.email.toLowerCase() !== 'hopezpaws@gmail.com')) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Image not found or not uploaded by your account.' } }, 403);
  } else {
    const doc = await c.env.DB.prepare('SELECT id, uploaded_by FROM documents WHERE id = ?').bind(documentId).first<{id:string;uploaded_by:string|null}>();
    if (!doc || (doc.uploaded_by !== actor.id && actor.email.toLowerCase() !== 'hopezpaws@gmail.com')) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Document not found or not uploaded by your account.' } }, 403);
  }

  const attachmentId = crypto.randomUUID();
  const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 180) : null;
  await c.env.DB.prepare(`
    INSERT INTO record_attachments (id, resource, record_id, media_asset_id, document_id, label, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(attachmentId, resource, recordId, mediaAssetId || null, documentId || null, label, actor.id).run();

  if (resource === 'animals' && mediaAssetId) {
    const primary = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM animal_media WHERE animal_id = ? AND is_primary = 1').bind(recordId).first<{count:number}>();
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO animal_media (id, animal_id, media_asset_id, is_primary, caption, sort_order)
      VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM animal_media WHERE animal_id = ?))
    `).bind(crypto.randomUUID(), recordId, mediaAssetId, primary?.count ? 0 : 1, label, recordId).run();
  }
  if (resource === 'website_content' && mediaAssetId) {
    await c.env.DB.prepare("UPDATE website_content SET media_asset_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = 'draft'")
      .bind(mediaAssetId, recordId).run();
  }
  if (documentId) {
    const documentField: Record<string, string> = {
      medical_records: 'attachment_doc_id',
      vaccinations: 'certificate_doc_id',
      adoption_applications: 'id_proof_doc_id',
      foster_applications: 'id_proof_doc_id',
      donations: 'proof_doc_id',
      expenses: 'invoice_doc_id',
      compliance_registrations: 'certificate_doc_id',
      purchase_orders: 'invoice_doc_id'
    };
    const field = documentField[resource];
    if (field) {
      await c.env.DB.prepare(`UPDATE ${config.table} SET ${field} = ? WHERE id = ?`).bind(documentId, recordId).run();
    } else if (resource === 'adoption_agreements') {
      await c.env.DB.prepare(`
        UPDATE adoption_agreements
        SET signed_agreement_doc_id = COALESCE(signed_agreement_doc_id, ?),
            handover_doc_id = CASE WHEN signed_agreement_doc_id IS NOT NULL THEN ? ELSE handover_doc_id END
        WHERE id = ?
      `).bind(documentId, documentId, recordId).run();
    }
  }

  await appendAuditLog(c, {
    action: 'ERP_ATTACHMENT_ADDED',
    entityType: resource,
    entityId: recordId,
    after: { attachmentId, mediaAssetId: mediaAssetId || null, documentId: documentId || null, label }
  });
  return c.json({ success: true, data: { id: attachmentId } }, 201);
});

adminModuleRoutes.get('/:resource', async (c) => {
  const resource = c.req.param('resource');
  const config = RESOURCES[resource];
  const actor = c.get('authUser');
  if (!config) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown ERP resource.' } }, 404);
  if (!actor.permissions.includes(config.read)) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view this resource.' } }, 403);

  const limit = Math.min(Math.max(Number(c.req.query('limit') || 50) || 50, 1), 200);
  const offset = Math.min(Math.max(Math.floor(Number(c.req.query('offset') || 0) || 0), 0), 1000000);
  const search = (c.req.query('q') || '').trim().slice(0, 100);
  const whereSql = search && config.search.length
    ? ' WHERE (' + config.search.map((col) => `${col} LIKE ?`).join(' OR ') + ')'
    : '';
  const searchParams: unknown[] = [];
  if (whereSql) {
    for (let i = 0; i < config.search.length; i++) searchParams.push(`%${search}%`);
  }
  const totalResult = await c.env.DB.prepare(`SELECT COUNT(*) AS total FROM ${config.table}${whereSql}`)
    .bind(...searchParams).first<{ total: number }>();
  const sql = resource === 'donations'
    ? `SELECT d.*, dr.id AS receipt_id, dr.receipt_number FROM donations d LEFT JOIN donation_receipts dr ON dr.donation_id = d.id${whereSql} ORDER BY d.${config.order} DESC LIMIT ? OFFSET ?`
    : `SELECT * FROM ${config.table}${whereSql} ORDER BY ${config.order} DESC LIMIT ? OFFSET ?`;
  const result = await c.env.DB.prepare(sql).bind(...searchParams, limit, offset).all();
  return c.json({
    success: true,
    data: {
      items: result.results || [],
      total: Number(totalResult?.total || 0),
      limit,
      offset,
      resource,
      readOnly: !config.write || config.immutable === true || !actor.permissions.includes(config.write)
    }
  });
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

  if (resource === 'animals' && (input.is_adoption_eligible !== undefined || input.is_foster_eligible !== undefined) && !actor.permissions.includes('adoption:approve')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Adoption permission is required to change animal adoption or foster eligibility.' } }, 403);
  }
  if (resource === 'animals') {
    const nextStatus = String(input.current_status || 'rescued');
    if (['adopted', 'fostered'].includes(nextStatus)) {
      return c.json({ success: false, error: { code: 'PRECONDITION_FAILED', message: 'Adopted or fostered status can only be set by the verified adoption/foster handover workflow.' } }, 409);
    }
    if (nextStatus === 'available_for_adoption' && (!actor.permissions.includes('adoption:approve') || Number(input.is_adoption_eligible || 0) !== 1)) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Marking an animal available requires adoption approval permission and adoption eligibility.' } }, 403);
    }
    if (nextStatus === 'released' && !actor.permissions.includes('rescue:write')) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Rescue permission is required to mark an animal released.' } }, 403);
    }
    if (nextStatus === 'deceased' && !actor.permissions.includes('medical:write')) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Medical permission is required to record a deceased animal.' } }, 403);
    }
  }

  if (resource === 'adoption_agreements') {
    const application = await c.env.DB.prepare('SELECT animal_id, status, home_check_status FROM adoption_applications WHERE id = ?').bind(String(input.application_id)).first<{animal_id:string;status:string;home_check_status:string}>();
    if (!application || application.status !== 'approved' || application.animal_id !== String(input.animal_id) || application.home_check_status !== 'passed') {
      return c.json({ success: false, error: { code: 'PRECONDITION_FAILED', message: 'An adoption agreement requires a home-check-passed approved application for the same animal.' } }, 409);
    }
    const animal = await c.env.DB.prepare('SELECT current_status, is_adoption_eligible, deleted_at FROM animals WHERE id = ?').bind(String(input.animal_id)).first<{current_status:string;is_adoption_eligible:number;deleted_at:string|null}>();
    if (!animal || animal.deleted_at || animal.current_status !== 'available_for_adoption' || animal.is_adoption_eligible !== 0) {
      return c.json({ success: false, error: { code: 'PRECONDITION_FAILED', message: 'The animal must be active, reserved by this approved application, and awaiting handover.' } }, 409);
    }
  }

  if (resource === 'medical_records' || resource === 'vaccinations') {
    const animalId = String(input.animal_id || '');
    const animal = await c.env.DB.prepare('SELECT id FROM animals WHERE id = ?').bind(animalId).first<{ id: string }>();
    if (!animal) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Select an existing animal record. Use the animal record ID from the Animals workspace, not its name or animal code.' } }, 400);
    if (input.veterinarian_id) {
      const vet = await c.env.DB.prepare('SELECT id FROM veterinarians WHERE id = ? AND is_active = 1').bind(String(input.veterinarian_id)).first<{ id: string }>();
      if (!vet) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Select an existing active veterinarian record, or leave Veterinarian ID blank.' } }, 400);
    }
  }
  if (resource === 'stock_movements') {
    const movement = String(input.movement_type || '');
    const quantity = Number(input.quantity_delta);
    if (!Number.isFinite(quantity) || quantity === 0 ||
      (['opening','purchase_in'].includes(movement) && quantity < 0) ||
      (['issue_out','expired_writeoff'].includes(movement) && quantity > 0)) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Use a positive quantity for opening/purchase-in and a negative quantity for issue/expiry write-off.' } }, 400);
    }
  }
  if (resource === 'website_content' || resource === 'volunteers') {
    const jsonField = resource === 'website_content' ? 'body_json' : 'skills_json';
    const raw = input[jsonField];
    if (raw !== undefined) {
      try {
        const parsedJson = JSON.parse(String(raw));
        if (resource === 'volunteers' && !Array.isArray(parsedJson)) throw new Error('Skills must be a JSON array.');
        if (resource === 'website_content' && (parsedJson === null || typeof parsedJson !== 'object')) throw new Error('Content must be a JSON object or array.');
      } catch {
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: resource === 'volunteers' ? 'Skills must be a valid JSON array.' : 'Content body must be valid JSON.' } }, 400);
      }
    }
  }

  const values: Record<string, unknown> = { ...(config.defaults || {}), ...input, ...(config.serverFields?.(actor.id) || {}) };
  if (resource === 'donations') values.verification_status = 'pending';
  if (resource === 'expenses') values.approval_status = 'pending';
  if (resource === 'website_content') {
    values.status = 'draft';
    const version = await c.env.DB.prepare('SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM website_content WHERE page_slug = ? AND section_key = ?').bind(String(values.page_slug), String(values.section_key)).first<{ next_version: number }>();
    values.version_number = version?.next_version ?? 1;
  }
  if (resource === 'inventory_items') values.current_stock = 0;
  if (resource === 'stock_movements') values.approval_status = 'pending';
  const id = crypto.randomUUID();
  const columns = ['id', ...Object.keys(values)];
  const placeholders = columns.map(() => '?').join(', ');
  const bindings = [id, ...Object.values(values)];
  const statements = [
    c.env.DB.prepare(`INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders})`).bind(...bindings)
  ];
  if (resource === 'inventory_items' && Number(values.opening_stock || 0) > 0) {
    statements.push(c.env.DB.prepare(`
      INSERT INTO stock_movements (
        id, item_id, movement_type, quantity_delta, approval_status, approved_by, notes, recorded_by
      ) VALUES (?, ?, 'opening', ?, 'approved', ?, 'Opening balance recorded during item creation', ?)
    `).bind(crypto.randomUUID(), id, Number(values.opening_stock), actor.id, actor.id));
  }
  // Item creation and its approved opening movement must commit or roll back together.
  await c.env.DB.batch(statements);
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
  if (resource === 'animals' && (parsed.value.is_adoption_eligible !== undefined || parsed.value.is_foster_eligible !== undefined) && !actor.permissions.includes('adoption:approve')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Adoption permission is required to change animal adoption or foster eligibility.' } }, 403);
  }
  if (resource === 'animals' && parsed.value.current_status !== undefined) {
    const nextStatus = String(parsed.value.current_status);
    if (['adopted', 'fostered'].includes(nextStatus)) {
      return c.json({ success: false, error: { code: 'PRECONDITION_FAILED', message: 'Adopted or fostered status can only be set by the verified adoption/foster handover workflow.' } }, 409);
    }
    if (nextStatus === 'available_for_adoption' && (!actor.permissions.includes('adoption:approve') || Number(parsed.value.is_adoption_eligible ?? existing.is_adoption_eligible ?? 0) !== 1)) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Marking an animal available requires adoption approval permission and adoption eligibility.' } }, 403);
    }
    if (nextStatus === 'released' && !actor.permissions.includes('rescue:write')) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Rescue permission is required to mark an animal released.' } }, 403);
    }
    if (nextStatus === 'deceased' && !actor.permissions.includes('medical:write')) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Medical permission is required to record a deceased animal.' } }, 403);
    }
  }
    if (resource === 'website_content' && existing.status !== 'draft') return c.json({ success: false, error: { code: 'CONFLICT', message: 'Published and archived CMS versions are immutable. Create a new draft version to make changes.' } }, 409);
  const setParts = keys.map((key) => `${key} = ?`);
  const updateBindings: (string | number | boolean | null)[] = keys.map((key) => parsed.value[key]!);
  if (resource === 'website_content' || resource === 'compliance_registrations') {
    setParts.push('updated_by = ?');
    updateBindings.push(actor.id);
  }
  if (resource === 'rescue_cases' && parsed.value.status === 'closed' && existing.status !== 'closed') {
    setParts.push("closed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  }
  setParts.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  await c.env.DB.prepare(`UPDATE ${config.table} SET ${setParts.join(', ')} WHERE id = ?`).bind(...updateBindings, id).run();
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


adminModuleRoutes.post('/foster_applications/:id/activate', async (c) => {
  const actor = c.get('authUser');
  if (!actor.permissions.includes('adoption:approve')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Adoption approval permission required.' } }, 403);
  }
  const id = c.req.param('id');
  const application = await c.env.DB.prepare(
    'SELECT id, animal_id, status FROM foster_applications WHERE id = ?'
  ).bind(id).first<{ id: string; animal_id: string; status: string }>();
  if (!application) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Foster application not found.' } }, 404);
  if (application.status !== 'approved') {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'Only approved foster applications can be activated.' } }, 409);
  }
  const animal = await c.env.DB.prepare(
    'SELECT current_status, is_foster_eligible, deleted_at FROM animals WHERE id = ?'
  ).bind(application.animal_id).first<{ current_status: string; is_foster_eligible: number; deleted_at: string | null }>();
  if (!animal || animal.deleted_at || animal.is_foster_eligible !== 1 || ['adopted', 'fostered', 'released', 'deceased'].includes(animal.current_status)) {
    return c.json({ success: false, error: { code: 'PRECONDITION_FAILED', message: 'This animal is not currently eligible for foster placement.' } }, 409);
  }
  const result = await c.env.DB.prepare(
    "UPDATE foster_applications SET status = 'active', reviewed_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = 'approved'"
  ).bind(actor.id, id).run();
  if ((result.meta?.changes ?? 0) !== 1) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'Foster application changed before activation.' } }, 409);
  }
  await appendAuditLog(c, {
    action: 'FOSTER_PLACEMENT_ACTIVATED',
    entityType: 'foster_applications',
    entityId: id,
    after: { status: 'active', animalId: application.animal_id }
  });
  return c.json({ success: true, data: { id, status: 'active', animalId: application.animal_id } });
});

adminModuleRoutes.post('/foster_applications/:id/complete', async (c) => {
  const actor = c.get('authUser');
  if (!actor.permissions.includes('adoption:approve')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Adoption approval permission required.' } }, 403);
  }
  const id = c.req.param('id');
  const application = await c.env.DB.prepare(
    'SELECT id, animal_id, status, actual_end_date FROM foster_applications WHERE id = ?'
  ).bind(id).first<{ id: string; animal_id: string; status: string; actual_end_date: string | null }>();
  if (!application) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Foster application not found.' } }, 404);
  if (application.status !== 'active' || !application.actual_end_date) {
    return c.json({ success: false, error: { code: 'PRECONDITION_FAILED', message: 'Record the actual foster end date before completing the placement.' } }, 409);
  }
  const result = await c.env.DB.prepare(
    "UPDATE foster_applications SET status = 'completed', reviewed_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = 'active' AND actual_end_date IS NOT NULL"
  ).bind(actor.id, id).run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('actual end date')) return null;
    throw error;
  });
  if (!result || (result.meta?.changes ?? 0) !== 1) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'Foster placement could not be completed. Verify the actual end date and current status.' } }, 409);
  }
  await appendAuditLog(c, {
    action: 'FOSTER_PLACEMENT_COMPLETED',
    entityType: 'foster_applications',
    entityId: id,
    after: { status: 'completed', actualEndDate: application.actual_end_date, animalId: application.animal_id }
  });
  return c.json({ success: true, data: { id, status: 'completed', animalId: application.animal_id } });
});

adminModuleRoutes.post('/animals/:id/publish', async (c) => {
  const actor = c.get('authUser');
  if (!actor.permissions.includes('animals:publish')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Animal publishing permission required.' } }, 403);
  }
  const body = await c.req.json().catch(() => null) as { published?: unknown } | null;
  if (typeof body?.published !== 'boolean') {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Provide published as true or false.' } }, 400);
  }
  const id = c.req.param('id');
  const animal = await c.env.DB.prepare('SELECT id, is_published_public, is_adoption_eligible, current_status, public_description, deleted_at FROM animals WHERE id = ?')
    .bind(id).first<{ id: string; is_published_public: number; is_adoption_eligible: number; current_status: string; public_description: string | null; deleted_at: string | null }>();
  if (!animal) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Animal record not found.' } }, 404);
  const adoptionReady = animal.current_status === 'adopted' ||
    (animal.current_status === 'available_for_adoption' && animal.is_adoption_eligible === 1);
  const rescueStoryReady = ['rescued', 'under_assessment', 'under_treatment', 'recovering'].includes(animal.current_status) &&
    Boolean(animal.public_description?.trim());
  if (body.published && (animal.deleted_at || (!adoptionReady && !rescueStoryReady))) {
    return c.json({ success: false, error: { code: 'PRECONDITION_FAILED', message: 'Publish only active adoption-ready animals or rescue/recovery stories with a public description. Fostered, released, and deceased records remain private.' } }, 409);
  }
  if (Boolean(animal.is_published_public) === body.published) {
    return c.json({ success: true, data: { id, is_published_public: body.published, unchanged: true } });
  }
  await c.env.DB.prepare("UPDATE animals SET is_published_public = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
    .bind(body.published ? 1 : 0, id).run();
  await appendAuditLog(c, {
    action: body.published ? 'ANIMAL_PUBLISHED_PUBLICLY' : 'ANIMAL_UNPUBLISHED_PUBLICLY',
    entityType: 'animals',
    entityId: id,
    before: { is_published_public: Boolean(animal.is_published_public) },
    after: { is_published_public: body.published }
  });
  return c.json({ success: true, data: { id, is_published_public: body.published } });
});

adminModuleRoutes.post('/cms/:id/publish', async (c) => {
  const actor = c.get('authUser');
  if (!actor.permissions.includes('cms:publish')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'CMS publishing permission required.' } }, 403);
  }
  const body = await c.req.json().catch(() => null) as { published?: unknown } | null;
  if (typeof body?.published !== 'boolean') {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Provide published as true or false.' } }, 400);
  }
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(
    'SELECT id, page_slug, section_key, status, version_number FROM website_content WHERE id = ?'
  ).bind(id).first<{ id: string; page_slug: string; section_key: string; status: string; version_number: number }>();
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'CMS content version not found.' } }, 404);

  if (body.published) {
    if (existing.status !== 'draft') {
      return c.json({ success: false, error: { code: 'CONFLICT', message: 'Only draft CMS versions can be published.' } }, 409);
    }
    const result = await c.env.DB.batch([
      c.env.DB.prepare(`
        UPDATE website_content
        SET status = 'published', published_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
            updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ? AND status = 'draft'
          AND version_number = (
            SELECT MAX(version_number) FROM website_content
            WHERE page_slug = ? AND section_key = ?
          )
      `).bind(actor.id, id, existing.page_slug, existing.section_key),
      c.env.DB.prepare(`
        UPDATE website_content
        SET status = 'archived', updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE page_slug = ? AND section_key = ? AND status = 'published' AND id <> ?
          AND EXISTS (SELECT 1 FROM website_content WHERE id = ? AND status = 'published')
      `).bind(actor.id, existing.page_slug, existing.section_key, id, id)
    ]);
    if ((result[0]?.meta?.changes ?? 0) !== 1) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: 'A newer CMS version exists or this draft was already processed. Refresh and try again.' } }, 409);
    }
    await appendAuditLog(c, {
      action: 'CMS_CONTENT_PUBLISHED',
      entityType: 'website_content',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'published', pageSlug: existing.page_slug, sectionKey: existing.section_key, version: existing.version_number }
    });
    return c.json({ success: true, data: { id, status: 'published' } });
  }

  if (existing.status !== 'published') {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'Only published CMS content can be unpublished.' } }, 409);
  }
  const result = await c.env.DB.prepare(`
    UPDATE website_content
    SET status = 'archived', updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ? AND status = 'published'
  `).bind(actor.id, id).run();
  if ((result.meta?.changes ?? 0) !== 1) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'CMS content changed before it could be unpublished.' } }, 409);
  }
  await appendAuditLog(c, {
    action: 'CMS_CONTENT_UNPUBLISHED',
    entityType: 'website_content',
    entityId: id,
    before: { status: 'published' },
    after: { status: 'archived', pageSlug: existing.page_slug, sectionKey: existing.section_key, version: existing.version_number }
  });
  return c.json({ success: true, data: { id, status: 'archived' } });
});

adminModuleRoutes.post('/:resource/:id/approve', async (c) => {
  const resource = c.req.param('resource');
  const id = c.req.param('id');
  const actor = c.get('authUser');

  if (resource === 'stock_movements') {
    if (!actor.permissions.includes('inventory:approve')) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Inventory approval permission required.' } }, 403);
    const row = await c.env.DB.prepare('SELECT id, item_id, movement_type, quantity_delta, approval_status, recorded_by FROM stock_movements WHERE id = ?').bind(id).first<{id:string;item_id:string;movement_type:string;quantity_delta:number;approval_status:string;recorded_by:string}>();
    if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Stock movement not found.' } }, 404);
    if (row.recorded_by === actor.id) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot approve your own stock movement.' } }, 403);
    if (row.approval_status !== 'pending') return c.json({ success: false, error: { code: 'CONFLICT', message: 'Only pending stock movements can be approved.' } }, 409);
    try {
      const result = await c.env.DB.prepare("UPDATE stock_movements SET approval_status = 'approved', approved_by = ? WHERE id = ? AND approval_status = 'pending'").bind(actor.id, id).run();
      if ((result.meta?.changes ?? 0) !== 1) return c.json({ success: false, error: { code: 'CONFLICT', message: 'Stock movement was already processed.' } }, 409);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('negative')) return c.json({ success: false, error: { code: 'INSUFFICIENT_STOCK', message: 'This issue would make stock negative. Check the current quantity.' } }, 409);
      throw error;
    }
    await appendAuditLog(c, { action: 'STOCK_MOVEMENT_APPROVED', entityType: 'stock_movements', entityId: id, after: { approval_status: 'approved', item_id: row.item_id, quantity_delta: row.quantity_delta } });
    return c.json({ success: true, data: { id, approved: true } });
  }

  if (resource === 'expenses') {
    if (!actor.permissions.includes('finance:approve')) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Finance approval permission required.' } }, 403);
    const row = await c.env.DB.prepare('SELECT id, submitted_by, approval_status FROM expenses WHERE id = ?').bind(id).first<{id:string;submitted_by:string;approval_status:string}>();
    if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Expense not found.' } }, 404);
    if (row.submitted_by === actor.id) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot approve your own expense claim.' } }, 403);
    if (row.approval_status !== 'pending') return c.json({ success: false, error: { code: 'CONFLICT', message: 'Only pending expense claims can be approved.' } }, 409);
    const approvalResult = await c.env.DB.prepare("UPDATE expenses SET approval_status = 'approved', approved_by = ?, approved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND approval_status = 'pending'").bind(actor.id, id).run();
    if ((approvalResult.meta?.changes ?? 0) !== 1) return c.json({ success: false, error: { code: 'CONFLICT', message: 'Expense was already reviewed.' } }, 409);
    await appendAuditLog(c, { action: 'EXPENSE_APPROVED', entityType: 'expenses', entityId: id, after: { approval_status: 'approved' } });
    return c.json({ success: true, data: { id, approved: true } });
  }

  if (resource === 'adoption_applications' || resource === 'foster_applications') {
    if (!actor.permissions.includes('adoption:approve')) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Adoption approval permission required.' } }, 403);
    const table = resource;
    const row = await c.env.DB.prepare(`SELECT id, status, animal_id, ${resource === 'adoption_applications' ? 'home_check_status' : 'animal_id'} as gate FROM ${table} WHERE id = ?`).bind(id).first<{id:string;status:string;animal_id:string;gate:string|null}>();
    if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found.' } }, 404);
    if (row.status === 'approved' || row.status === 'rejected' || row.status === 'completed') return c.json({ success: false, error: { code: 'CONFLICT', message: 'This application has already been decided.' } }, 409);
    const allowedStatuses = resource === 'adoption_applications'
      ? "'application','initial_review','verification'"
      : "'application','verification'";
    if (!allowedStatuses.split(',').some((status) => status.replaceAll("'", '') === row.status)) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: 'This application is not in a reviewable status.' } }, 409);
    }
    if (resource === 'adoption_applications' && row.gate !== 'passed') return c.json({ success: false, error: { code: 'PRECONDITION_FAILED', message: 'A passed home check is required before adoption approval.' } }, 409);
    if (resource === 'adoption_applications') {
      const animal = await c.env.DB.prepare('SELECT is_adoption_eligible, current_status FROM animals WHERE id = ?').bind(row.animal_id).first<{is_adoption_eligible:number;current_status:string}>();
      if (!animal || animal.is_adoption_eligible !== 1 || animal.current_status !== 'available_for_adoption') {
        return c.json({ success: false, error: { code: 'PRECONDITION_FAILED', message: 'This animal is no longer marked as available and eligible for adoption.' } }, 409);
      }
    }
    const body = await c.req.json().catch(() => ({})) as { reason?: unknown };
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 1000) : null;
    const result = await c.env.DB.prepare(`UPDATE ${table} SET status = 'approved', reviewed_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status IN (${allowedStatuses})`).bind(actor.id, id).run().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (resource === 'adoption_applications' && (/Animal is not currently eligible/i.test(message) || /UNIQUE constraint failed: adoption_applications\.animal_id/i.test(message))) return null;
      throw error;
    });
    if (!result || (result.meta?.changes ?? 0) !== 1) return c.json({ success: false, error: { code: 'CONFLICT', message: 'Application changed or the animal is no longer available for adoption.' } }, 409);
    await appendAuditLog(c, { action: 'APPLICATION_APPROVED', entityType: resource, entityId: id, after: { status: 'approved', reason } });
    return c.json({ success: true, data: { id, status: 'approved' } });
  }

  return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'No approval workflow exists for this resource.' } }, 404);
});

adminModuleRoutes.post('/:resource/:id/reject', async (c) => {
  const resource = c.req.param('resource');
  const id = c.req.param('id');
  const actor = c.get('authUser');
  const body = await c.req.json().catch(() => ({})) as { reason?: unknown };
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 1000) : '';
  if (!reason.trim()) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'A rejection reason is required.' } }, 400);

  if (resource === 'expenses') {
    if (!actor.permissions.includes('finance:approve')) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Finance approval permission required.' } }, 403);
    const row = await c.env.DB.prepare('SELECT id, submitted_by, approval_status FROM expenses WHERE id = ?').bind(id).first<{id:string;submitted_by:string;approval_status:string}>();
    if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Expense not found.' } }, 404);
    if (row.submitted_by === actor.id) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot review your own expense claim.' } }, 403);
    if (row.approval_status !== 'pending') return c.json({ success: false, error: { code: 'CONFLICT', message: 'Only pending expense claims can be rejected.' } }, 409);
    const rejectionResult = await c.env.DB.prepare("UPDATE expenses SET approval_status = 'rejected', approved_by = ?, approved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND approval_status = 'pending'").bind(actor.id, id).run();
    if ((rejectionResult.meta?.changes ?? 0) !== 1) return c.json({ success: false, error: { code: 'CONFLICT', message: 'Expense was already reviewed.' } }, 409);
    await appendAuditLog(c, { action: 'EXPENSE_REJECTED', entityType: 'expenses', entityId: id, after: { approval_status: 'rejected', reason } });
    return c.json({ success: true, data: { id, status: 'rejected' } });
  }
  if (resource === 'adoption_applications' || resource === 'foster_applications') {
    if (!actor.permissions.includes('adoption:approve')) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Adoption approval permission required.' } }, 403);
    const allowedStatuses = resource === 'adoption_applications'
      ? "'application','initial_review','verification'"
      : "'application','verification'";
    const result = resource === 'adoption_applications'
      ? await c.env.DB.prepare(`UPDATE adoption_applications SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status IN (${allowedStatuses})`).bind(reason, actor.id, id).run()
      : await c.env.DB.prepare(`UPDATE foster_applications SET status = 'rejected', notes = ?, reviewed_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status IN (${allowedStatuses})`).bind(reason, actor.id, id).run();
    if ((result.meta?.changes ?? 0) !== 1) return c.json({ success: false, error: { code: 'NOT_FOUND_OR_CONFLICT', message: 'Application not found or already decided.' } }, 409);
    await appendAuditLog(c, { action: 'APPLICATION_REJECTED', entityType: resource, entityId: id, after: { status: 'rejected', reason } });
    return c.json({ success: true, data: { id, status: 'rejected' } });
  }
  return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'No rejection workflow exists for this resource.' } }, 404);
});

adminModuleRoutes.post('/donations/:id/verify', async (c) => {
  const actor = c.get('authUser');
  if (!actor.permissions.includes('donations:verify')) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Donation verification permission required.' } }, 403);
  const id = c.req.param('id');
  const donation = await c.env.DB.prepare("SELECT * FROM donations WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!donation) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Donation not found.' } }, 404);
  if (donation.verification_status !== 'pending') return c.json({ success: false, error: { code: 'CONFLICT', message: 'Only pending donations can be verified.' } }, 409);
  const receivingAccount = await c.env.DB.prepare("SELECT id, account_type, is_active FROM accounts WHERE id = ?").bind(String(donation.account_id)).first<{id:string;account_type:string;is_active:number}>();
  if (!receivingAccount || receivingAccount.account_type !== 'asset' || receivingAccount.is_active !== 1) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Donation must be assigned to an active cash/bank asset account.' } }, 409);
  const income = await c.env.DB.prepare("SELECT id FROM accounts WHERE account_type = 'income' AND is_active = 1 ORDER BY code LIMIT 1").first<{id:string}>();
  if (!income) return c.json({ success: false, error: { code: 'PRECONDITION_FAILED', message: 'No active income account is configured.' } }, 409);
  const txnId = crypto.randomUUID();
  const txnNo = `PHS-TXN-${Date.now()}-${crypto.randomUUID().slice(0,8)}`;
  const ip = c.req.header('CF-Connecting-IP') || null;
  const ua = c.req.header('User-Agent') || null;
  const results = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE donations SET verification_status = 'verified', verified_by = ?, verified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND verification_status = 'pending'").bind(actor.id, id),
    c.env.DB.prepare("INSERT INTO financial_transactions (id, txn_number, txn_date, entry_type, debit_account_id, credit_account_id, fund_category_id, amount_paise, reference_type, reference_id, narration, created_by) SELECT ?, ?, ?, 'income', ?, ?, ?, ?, 'donation', ?, ?, ? WHERE EXISTS (SELECT 1 FROM donations WHERE id = ? AND verification_status = 'verified' AND verified_by = ?) AND NOT EXISTS (SELECT 1 FROM financial_transactions WHERE reference_type = 'donation' AND reference_id = ? AND entry_type = 'income')").bind(txnId, txnNo, String(donation.donation_date), String(donation.account_id), income.id, String(donation.fund_category_id), Number(donation.amount_paise), id, `Donation verified: ${id}`, actor.id, id, actor.id, id),
    c.env.DB.prepare("INSERT INTO audit_logs (id, actor_user_id, actor_email, action, entity_type, entity_id, after_json, ip_address, user_agent) SELECT ?, ?, ?, 'DONATION_VERIFIED', 'donations', ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM financial_transactions WHERE id = ?)").bind(crypto.randomUUID(), actor.id, actor.email, id, JSON.stringify({ verification_status: 'verified', txn_number: txnNo }), ip, ua, txnId)
  ]);
  if ((results[0]?.meta?.changes ?? 0) !== 1 || (results[1]?.meta?.changes ?? 0) !== 1 || (results[2]?.meta?.changes ?? 0) !== 1) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'Donation was already verified or its ledger posting already exists.' } }, 409);
  }
  return c.json({ success: true, data: { id, verification_status: 'verified', transaction_number: txnNo } });
});

adminModuleRoutes.post('/donations/:id/receipt', async (c) => {
  const actor = c.get('authUser');
  if (!actor.permissions.includes('donations:verify')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Donation verification permission is required to issue receipts.' } }, 403);
  }
  const id = c.req.param('id');
  const donation = await c.env.DB.prepare(`
    SELECT d.id, d.donation_date, d.amount_paise, d.payment_mode, d.transaction_reference,
      d.purpose, d.verification_status, d.donor_id,
      donor.full_name AS donor_name, donor.email AS donor_email,
      donor.address AS donor_address, donor.pan_number AS donor_pan
    FROM donations d
    JOIN donors donor ON donor.id = d.donor_id
    WHERE d.id = ?
  `).bind(id).first<{
    id: string; donation_date: string; amount_paise: number; payment_mode: string;
    transaction_reference: string | null; purpose: string | null; verification_status: string;
    donor_id: string; donor_name: string; donor_email: string | null;
    donor_address: string | null; donor_pan: string | null;
  }>();
  if (!donation) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Donation not found.' } }, 404);
  if (donation.verification_status !== 'verified') {
    return c.json({ success: false, error: { code: 'PRECONDITION_FAILED', message: 'Only a verified donation can receive an official receipt.' } }, 409);
  }
  const existing = await c.env.DB.prepare(
    'SELECT id, receipt_number, issued_date, is_80g_eligible FROM donation_receipts WHERE donation_id = ?'
  ).bind(id).first<{id:string;receipt_number:string;issued_date:string;is_80g_eligible:number}>();
  if (existing) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: `A receipt already exists: ${existing.receipt_number}` }, data: existing }, 409);
  }
  const issuedDate = new Date().toISOString().slice(0, 10);
  const receiptId = crypto.randomUUID();
  const receiptNumber = `PHS-REC-${issuedDate.replaceAll('-', '')}-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
  const result = await c.env.DB.prepare(`
    INSERT INTO donation_receipts (id, receipt_number, donation_id, issued_date, is_80g_eligible, issued_by)
    SELECT ?, ?, ?, ?, 0, ?
    WHERE EXISTS (SELECT 1 FROM donations WHERE id = ? AND verification_status = 'verified')
      AND NOT EXISTS (SELECT 1 FROM donation_receipts WHERE donation_id = ?)
  `).bind(receiptId, receiptNumber, id, issuedDate, actor.id, id, id).run();
  if ((result.meta.changes ?? 0) !== 1) {
    const duplicate = await c.env.DB.prepare('SELECT receipt_number FROM donation_receipts WHERE donation_id = ?')
      .bind(id).first<{receipt_number:string}>();
    return c.json({ success: false, error: { code: 'CONFLICT', message: duplicate ? `A receipt already exists: ${duplicate.receipt_number}` : 'The donation changed before the receipt could be issued.' } }, 409);
  }
  await appendAuditLog(c, {
    action: 'DONATION_RECEIPT_ISSUED',
    entityType: 'donation_receipts',
    entityId: receiptId,
    after: { receiptNumber, donationId: id, amountPaise: donation.amount_paise, is80gEligible: false }
  });
  return c.json({ success: true, data: {
    id: receiptId, receiptNumber, donationId: id, issuedDate,
    amountPaise: donation.amount_paise, paymentMode: donation.payment_mode,
    donationDate: donation.donation_date, donorName: donation.donor_name,
    donorEmail: donation.donor_email, donorAddress: donation.donor_address,
    donorPan: donation.donor_pan, purpose: donation.purpose,
    is80gEligible: false, pdfDocId: null,
    note: 'Receipt issued. 80G eligibility is not claimed; attach an approved receipt PDF when available.'
  } }, 201);
});

adminModuleRoutes.post('/expenses/:id/mark-paid', async (c) => {
  const actor = c.get('authUser');
  if (!actor.permissions.includes('finance:ledger')) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Ledger posting permission required.' } }, 403);
  const id = c.req.param('id');
  const expense = await c.env.DB.prepare('SELECT * FROM expenses WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!expense) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Expense not found.' } }, 404);
  if (expense.approved_by === actor.id) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'A different finance user must post payment after approval.' } }, 403);
  if (expense.approval_status !== 'approved' || expense.payment_status !== 'unpaid') return c.json({ success: false, error: { code: 'CONFLICT', message: 'Only approved, unpaid expenses can be posted as paid.' } }, 409);
  const paymentAccount = await c.env.DB.prepare("SELECT id, account_type, is_active FROM accounts WHERE id = ?").bind(String(expense.account_id)).first<{id:string;account_type:string;is_active:number}>();
  if (!paymentAccount || paymentAccount.account_type !== 'asset' || paymentAccount.is_active !== 1) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Expense payment must use an active cash/bank asset account.' } }, 409);
  const expenseAccount = await c.env.DB.prepare("SELECT id FROM accounts WHERE account_type = 'expense' AND is_active = 1 ORDER BY code LIMIT 1").first<{id:string}>();
  if (!expenseAccount) return c.json({ success: false, error: { code: 'PRECONDITION_FAILED', message: 'No active expense account is configured.' } }, 409);
  const txnId = crypto.randomUUID();
  const txnNo = `PHS-TXN-${Date.now()}-${crypto.randomUUID().slice(0,8)}`;
  const ip = c.req.header('CF-Connecting-IP') || null;
  const ua = c.req.header('User-Agent') || null;
  const results = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE expenses SET payment_status = 'paid', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND approval_status = 'approved' AND payment_status = 'unpaid'").bind(id),
    c.env.DB.prepare("INSERT INTO financial_transactions (id, txn_number, txn_date, entry_type, debit_account_id, credit_account_id, fund_category_id, amount_paise, reference_type, reference_id, narration, created_by) SELECT ?, ?, ?, 'expense', ?, ?, ?, ?, 'expense', ?, ?, ? WHERE EXISTS (SELECT 1 FROM expenses WHERE id = ? AND approval_status = 'approved' AND payment_status = 'paid') AND NOT EXISTS (SELECT 1 FROM financial_transactions WHERE reference_type = 'expense' AND reference_id = ? AND entry_type = 'expense')").bind(txnId, txnNo, String(expense.expense_date), expenseAccount.id, String(expense.account_id), String(expense.fund_category_id), Number(expense.amount_paise), id, `Expense paid: ${id}`, actor.id, id, id),
    c.env.DB.prepare("INSERT INTO audit_logs (id, actor_user_id, actor_email, action, entity_type, entity_id, after_json, ip_address, user_agent) SELECT ?, ?, ?, 'EXPENSE_PAID_AND_POSTED', 'expenses', ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM financial_transactions WHERE id = ?)").bind(crypto.randomUUID(), actor.id, actor.email, id, JSON.stringify({ payment_status: 'paid', txn_number: txnNo }), ip, ua, txnId)
  ]);
  if ((results[0]?.meta?.changes ?? 0) !== 1 || (results[1]?.meta?.changes ?? 0) !== 1 || (results[2]?.meta?.changes ?? 0) !== 1) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'Expense was already marked paid or its ledger posting already exists.' } }, 409);
  }
  return c.json({ success: true, data: { id, payment_status: 'paid', transaction_number: txnNo } });
});


adminModuleRoutes.get('/inventory/alerts', async (c) => {
  const actor = c.get('authUser');
  if (!actor.permissions.includes('inventory:read')) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Inventory read permission required.' } }, 403);
  const [lowStock, expiring, expired] = await Promise.all([
    c.env.DB.prepare('SELECT id, sku, name, current_stock, min_stock_threshold, unit FROM inventory_items WHERE min_stock_threshold > 0 AND current_stock <= min_stock_threshold ORDER BY current_stock ASC LIMIT 100').all(),
    c.env.DB.prepare("SELECT sm.id, sm.item_id, i.name AS item_name, sm.batch_number, sm.expiry_date, sm.quantity_delta FROM stock_movements sm JOIN inventory_items i ON i.id = sm.item_id WHERE sm.approval_status = 'approved' AND sm.expiry_date >= date('now') AND sm.expiry_date <= date('now', '+30 days') ORDER BY sm.expiry_date ASC LIMIT 100").all(),
    c.env.DB.prepare("SELECT sm.id, sm.item_id, i.name AS item_name, sm.batch_number, sm.expiry_date, sm.quantity_delta FROM stock_movements sm JOIN inventory_items i ON i.id = sm.item_id WHERE sm.approval_status = 'approved' AND sm.expiry_date < date('now') ORDER BY sm.expiry_date ASC LIMIT 100").all(),
  ]);
  return c.json({ success: true, data: { lowStock: lowStock.results || [], expiring: expiring.results || [], expired: expired.results || [] } });
});

adminModuleRoutes.get('/medical/alerts', async (c) => {
  const actor = c.get('authUser');
  if (!actor.permissions.includes('medical:read')) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Medical read permission required.' } }, 403);
  const [due, overdue] = await Promise.all([
    c.env.DB.prepare("SELECT v.id, v.animal_id, a.name AS animal_name, v.vaccine_name, v.next_due_date FROM vaccinations v JOIN animals a ON a.id = v.animal_id WHERE v.next_due_date >= date('now') AND v.next_due_date <= date('now', '+30 days') ORDER BY v.next_due_date ASC LIMIT 100").all(),
    c.env.DB.prepare("SELECT v.id, v.animal_id, a.name AS animal_name, v.vaccine_name, v.next_due_date FROM vaccinations v JOIN animals a ON a.id = v.animal_id WHERE v.next_due_date < date('now') ORDER BY v.next_due_date ASC LIMIT 100").all(),
  ]);
  return c.json({ success: true, data: { due: due.results || [], overdue: overdue.results || [] } });
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
