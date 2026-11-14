import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../../types/env';
import { requirePermission } from '../../middleware/rbac';
import {
  validateUploadFile,
  createSignedDocumentToken,
  verifySignedDocumentToken,
  type AllowedMime,
} from '../../services/r2Storage';
import { appendAuditLog } from '../../services/audit';

export const adminDocumentRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
export const publicFileProxyRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

const ALLOWED_DOC_CATEGORIES = new Set([
  'vet_bill',
  'prescription',
  'lab_report',
  'vaccination_cert',
  'adoption_agreement',
  'foster_agreement',
  'applicant_id',
  'donor_proof',
  'donation_receipt',
  'expense_invoice',
  'purchase_invoice',
  'compliance_cert',
  'rescue_evidence',
  'other',
]);

adminDocumentRoutes.post('/uploads/public-media', async (c) => {
  const user = c.get('authUser');
  const canUpload =
    user.permissions.includes('animals:write') ||
    user.permissions.includes('cms:write') ||
    user.permissions.includes('rescue:write');

  if (!canUpload) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to upload media.' } },
      403
    );
  }

  const formData = await c.req.formData().catch(() => null);
  const file = formData?.get('file');
  const altText = String(formData?.get('altText') || '');

  if (!(file instanceof File)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Missing file field.' } },
      400
    );
  }

  try {
    const buffer = await file.arrayBuffer();
    const { mime, ext } = validateUploadFile(buffer, ['image/jpeg', 'image/png', 'image/webp']);
    const id = crypto.randomUUID();
    const r2Key = `media/${new Date().getUTCFullYear()}/${id}.${ext}`;

    await c.env.PUBLIC_MEDIA.put(r2Key, buffer, {
      httpMetadata: { contentType: mime, cacheControl: 'public, max-age=31536000, immutable' },
    });

    const baseUrl = c.env.PUBLIC_MEDIA_BASE_URL.replace(/\/$/, '');
    const publicUrl = `${baseUrl}/${r2Key}`;

    await c.env.DB.prepare(
      `INSERT INTO media_assets (id, r2_key, public_url, file_name, mime_type, size_bytes, alt_text, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, r2Key, publicUrl, file.name, mime, buffer.byteLength, altText || null, user.id)
      .run();

    await appendAuditLog(c, {
      action: 'PUBLIC_MEDIA_UPLOADED',
      entityType: 'media_assets',
      entityId: id,
      after: { r2Key, mime, sizeBytes: buffer.byteLength },
    });

    return c.json({ success: true, data: { id, r2Key, publicUrl, mime } }, 201);
  } catch (err) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UPLOAD_REJECTED',
          message: err instanceof Error ? err.message : 'File upload failed.',
        },
      },
      400
    );
  }
});

adminDocumentRoutes.post('/uploads/private-doc', async (c) => {
  const user = c.get('authUser');
  const canUpload =
    user.permissions.includes('medical:write') ||
    user.permissions.includes('expenses:submit') ||
    user.permissions.includes('donations:write') ||
    user.permissions.includes('adoption:write') ||
    user.permissions.includes('compliance:write') ||
    user.permissions.includes('rescue:write');

  if (!canUpload) {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to upload private documents.' },
      },
      403
    );
  }

  const formData = await c.req.formData().catch(() => null);
  const file = formData?.get('file');
  const docCategory = String(formData?.get('docCategory') || 'other');
  const title = String(formData?.get('title') || '').trim();
  const expiryDate = formData?.get('expiryDate') ? String(formData.get('expiryDate')) : null;

  if (!(file instanceof File) || !title) {
    return c.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Both file and title are required.' },
      },
      400
    );
  }

  if (!ALLOWED_DOC_CATEGORIES.has(docCategory)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid docCategory.' } },
      400
    );
  }

  try {
    const buffer = await file.arrayBuffer();
    const allowed: AllowedMime[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const { mime, ext } = validateUploadFile(buffer, allowed);
    const id = crypto.randomUUID();
    const r2PrivateKey = `vault/${docCategory}/${new Date().getUTCFullYear()}/${id}.${ext}`;

    await c.env.PRIVATE_VAULT.put(r2PrivateKey, buffer, {
      httpMetadata: { contentType: mime },
    });

    await c.env.DB.prepare(
      `INSERT INTO documents (id, r2_private_key, doc_category, title, file_name, mime_type, size_bytes, expiry_date, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, r2PrivateKey, docCategory, title, file.name, mime, buffer.byteLength, expiryDate, user.id)
      .run();

    await appendAuditLog(c, {
      action: 'PRIVATE_DOC_UPLOADED',
      entityType: 'documents',
      entityId: id,
      after: { docCategory, title, mime, sizeBytes: buffer.byteLength },
    });

    return c.json({ success: true, data: { id, docCategory, title, mime } }, 201);
  } catch (err) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UPLOAD_REJECTED',
          message: err instanceof Error ? err.message : 'Private document upload failed.',
        },
      },
      400
    );
  }
});

adminDocumentRoutes.get(
  '/documents/:id/signed-url',
  requirePermission('documents:private_read'),
  async (c) => {
    const docId = c.req.param('id');
    const user = c.get('authUser');

    const doc = await c.env.DB.prepare(
      'SELECT id, title, doc_category, mime_type FROM documents WHERE id = ?'
    )
      .bind(docId)
      .first<{ id: string; title: string; doc_category: string; mime_type: string }>();

    if (!doc) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Document not found.' } },
        404
      );
    }

    const { token, expiresAt } = await createSignedDocumentToken(
      doc.id,
      user.id,
      c.env.SIGNED_URL_SECRET,
      300
    );

    await appendAuditLog(c, {
      action: 'PRIVATE_DOC_SIGNED_URL_ISSUED',
      entityType: 'documents',
      entityId: doc.id,
      after: { title: doc.title, expiresAt },
    });

    return c.json({
      success: true,
      data: {
        url: `/api/v1/files/private/${token}`,
        expiresAt,
      },
    });
  }
);

publicFileProxyRoutes.get('/private/:token', async (c) => {
  const token = c.req.param('token');
  try {
    const { documentId } = await verifySignedDocumentToken(token, c.env.SIGNED_URL_SECRET);
    const doc = await c.env.DB.prepare(
      'SELECT r2_private_key, file_name, mime_type FROM documents WHERE id = ?'
    )
      .bind(documentId)
      .first<{ r2_private_key: string; file_name: string; mime_type: string }>();

    if (!doc) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'File missing.' } }, 404);
    }

    const obj = await c.env.PRIVATE_VAULT.get(doc.r2_private_key);
    if (!obj) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'R2 object missing.' } },
        404
      );
    }

    c.header('Content-Type', doc.mime_type);
    c.header('Content-Disposition', `inline; filename="${doc.file_name.replace(/"/g, '')}"`);
    c.header('Cache-Control', 'no-store, private');
    return c.body(obj.body);
  } catch (err) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: err instanceof Error ? err.message : 'Invalid or expired file link.',
        },
      },
      401
    );
  }
});
