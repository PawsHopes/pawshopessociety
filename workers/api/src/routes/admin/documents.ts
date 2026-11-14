import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../../types/env';
import { requirePermission, loadRbacUser } from '../../middleware/rbac';
import { cfAccessAuth } from '../../middleware/cfAccessAuth';
import {
  validateUploadFile,
  createSignedDocumentToken,
  verifySignedDocumentToken,
  type AllowedMime,
} from '../../services/r2Storage';
import {
  canReadDocumentCategory,
  canUploadDocumentCategory,
} from '../../services/documentAccess';
import { appendAuditLog } from '../../services/audit';

export const adminDocumentRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AppVariables;
}>();

export const publicFileProxyRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AppVariables;
}>();

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const CATEGORIES = new Set([
  'vet_bill', 'prescription', 'lab_report', 'vaccination_cert',
  'adoption_agreement', 'foster_agreement', 'applicant_id',
  'donor_proof', 'donation_receipt', 'expense_invoice',
  'purchase_invoice', 'compliance_cert', 'rescue_evidence', 'other',
]);

function safeFileName(input: string): string {
  const leaf = input.split(/[\\/]/).pop() ?? 'document';
  const cleaned = leaf
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 120);
  return cleaned || 'document';
}

function makeContentDisposition(input: string): string {
  const safe = safeFileName(input);
  const ascii = safe.replace(/[^\x20-\x7E]/g, '_').replace(/["\\;]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

function checkContentLength(c: any) {
  const lengthHeader = c.req.header('Content-Length');
  if (lengthHeader && Number(lengthHeader) > MAX_UPLOAD_BYTES + 256 * 1024) {
    return c.json({
      success: false,
      error: { code: 'FILE_TOO_LARGE', message: 'Upload exceeds the 10 MB limit.' }
    }, 413);
  }
  return null;
}

adminDocumentRoutes.post('/uploads/public-media', async (c) => {
  const user = c.get('authUser');
  const allowed =
    user.roleCode === 'super_admin' ||
    user.permissions.includes('animals:write') ||
    user.permissions.includes('cms:write') ||
    user.permissions.includes('rescue:write');

  if (!allowed) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorised.' } }, 403);
  }

  const sizeError = checkContentLength(c);
  if (sizeError) return sizeError;

  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  const altText = String(form?.get('altText') || '').slice(0, 500);

  if (!file || typeof file === 'string') {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'File is required.' } }, 400);
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return c.json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'File must be under 10 MB.' } }, 413);
  }

  try {
    const buffer = await file.arrayBuffer();
    const { mime, ext } = validateUploadFile(buffer, ['image/jpeg', 'image/png', 'image/webp']);
    const id = crypto.randomUUID();
    const key = `media/${new Date().getUTCFullYear()}/${id}.${ext}`;

    await c.env.PUBLIC_MEDIA.put(key, buffer, {
      httpMetadata: { contentType: mime, cacheControl: 'public, max-age=31536000, immutable' }
    });

    const baseUrl = c.env.PUBLIC_MEDIA_BASE_URL.replace(/\/$/, '');
    const publicUrl = `${baseUrl}/${key}`;

    await c.env.DB.prepare(`
      INSERT INTO media_assets (
        id, r2_key, public_url, file_name, mime_type,
        size_bytes, alt_text, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, key, publicUrl, safeFileName(file.name), mime,
      buffer.byteLength, altText || null, user.id
    ).run();

    await appendAuditLog(c, {
      action: 'PUBLIC_MEDIA_UPLOADED',
      entityType: 'media_assets',
      entityId: id,
      after: { mime, sizeBytes: buffer.byteLength }
    });

    return c.json({ success: true, data: { id, key, publicUrl, mime } }, 201);
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'UPLOAD_REJECTED', message: error instanceof Error ? error.message : 'Upload failed.' }
    }, 400);
  }
});

adminDocumentRoutes.post('/uploads/private-doc', async (c) => {
  const user = c.get('authUser');
  const sizeError = checkContentLength(c);
  if (sizeError) return sizeError;

  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  const category = String(form?.get('docCategory') || 'other');
  const title = String(form?.get('title') || '').trim().slice(0, 180);
  const expiryDate = form?.get('expiryDate') ? String(form.get('expiryDate')) : null;

  if (!file || typeof file === 'string' || !title) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'File and title are required.' } }, 400);
  }
  if (!CATEGORIES.has(category)) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid document category.' } }, 400);
  }
  if (!canUploadDocumentCategory(user, category)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorised for this document category.' } }, 403);
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return c.json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'File must be under 10 MB.' } }, 413);
  }
  if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid expiry date.' } }, 400);
  }

  try {
    const buffer = await file.arrayBuffer();
    const allowed: AllowedMime[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const { mime, ext } = validateUploadFile(buffer, allowed);
    const id = crypto.randomUUID();
    const key = `vault/${category}/${new Date().getUTCFullYear()}/${id}.${ext}`;

    await c.env.PRIVATE_VAULT.put(key, buffer, { httpMetadata: { contentType: mime } });

    await c.env.DB.prepare(`
      INSERT INTO documents (
        id, r2_private_key, doc_category, title,
        file_name, mime_type, size_bytes, expiry_date, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, key, category, title, safeFileName(file.name), mime,
      buffer.byteLength, expiryDate, user.id
    ).run();

    await appendAuditLog(c, {
      action: 'PRIVATE_DOC_UPLOADED',
      entityType: 'documents',
      entityId: id,
      after: { category, title, mime, sizeBytes: buffer.byteLength }
    });

    return c.json({ success: true, data: { id, category, title, mime } }, 201);
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'UPLOAD_REJECTED', message: error instanceof Error ? error.message : 'Upload failed.' }
    }, 400);
  }
});

adminDocumentRoutes.get(
  '/documents/:id/signed-url',
  requirePermission('documents:private_read'),
  async (c) => {
    const id = c.req.param('id');
    const user = c.get('authUser');

    const doc = await c.env.DB.prepare(`
      SELECT id, title, doc_category
      FROM documents WHERE id = ?
    `).bind(id).first<{ id: string; title: string; doc_category: string }>();

    if (!doc) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found.' } }, 404);
    }
    if (!canReadDocumentCategory(user, doc.doc_category)) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorised.' } }, 403);
    }

    const { token, expiresAt } = await createSignedDocumentToken(
      doc.id, user.id, c.env.SIGNED_URL_SECRET, 300
    );

    await appendAuditLog(c, {
      action: 'PRIVATE_DOC_SIGNED_URL_ISSUED',
      entityType: 'documents',
      entityId: doc.id,
      after: { category: doc.doc_category, expiresAt }
    });

    return c.json({
      success: true,
      data: { url: `${new URL(c.req.url).origin}/api/v1/files/private/${token}`, expiresAt }
    });
  }
);

// Download requires a fresh Cloudflare Access identity and the same user who received the token.
publicFileProxyRoutes.get('/private/:token', cfAccessAuth, loadRbacUser, async (c) => {
  try {
    const token = c.req.param('token');
    const verified = await verifySignedDocumentToken(token, c.env.SIGNED_URL_SECRET);
    const user = c.get('authUser');

    if (verified.userId !== user.id) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'This file link belongs to another account.' } }, 403);
    }

    const doc = await c.env.DB.prepare(`
      SELECT r2_private_key, file_name, mime_type, doc_category
      FROM documents WHERE id = ?
    `).bind(verified.documentId).first<{
      r2_private_key: string;
      file_name: string;
      mime_type: string;
      doc_category: string;
    }>();

    if (!doc) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'File missing.' } }, 404);
    }
    if (!canReadDocumentCategory(user, doc.doc_category)) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Your document permission has changed.' } }, 403);
    }

    const object = await c.env.PRIVATE_VAULT.get(doc.r2_private_key);
    if (!object) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Stored file missing.' } }, 404);
    }

    c.header('Content-Type', doc.mime_type);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Content-Disposition', makeContentDisposition(doc.file_name));
    c.header('Cache-Control', 'no-store, private');
    return c.body(object.body);
  } catch {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired file link.' }
    }, 401);
  }
});
