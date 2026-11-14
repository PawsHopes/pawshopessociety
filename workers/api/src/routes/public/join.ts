import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Bindings, AppVariables } from '../../types/env';
import { rateLimit } from '../../middleware/rateLimit';

export const publicJoinRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AppVariables;
}>();

publicJoinRoutes.use('/:token', rateLimit({ bucket: 'public-join-form', maxRequests: 8, windowSeconds: 600 }));

export async function hashJoinToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  );
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[character] ?? character;
  });
}

function page(title: string, content: string, status = 200) {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — Paw's Hopez Society</title>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
${content}
</main>
</body>
</html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    }
  );
}

type JoinContext = Context<{ Bindings: Bindings; Variables: AppVariables }>;

async function findActiveLink(c: JoinContext, token: string) {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return null;

  const tokenHash = await hashJoinToken(token);
  return c.env.DB.prepare(`
    SELECT id, label, expires_at AS expiresAt
    FROM join_links
    WHERE token_hash = ?
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).bind(tokenHash).first<{
    id: string;
    label: string;
    expiresAt: string | null;
  }>();
}

const applicationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(25).optional().default(''),
  message: z.string().trim().max(1000).optional().default(''),
});

publicJoinRoutes.get('/:token', async (c) => {
  const token = c.req.param('token');
  const link = await findActiveLink(c, token);

  if (!link) {
    return page(
      'Invitation link unavailable',
      '<p>This join link is invalid, expired or has been revoked. Please contact Paws Hopez Society for a current link.</p>',
      404
    );
  }

  const action = `/api/v1/public/join/${encodeURIComponent(token)}`;

  return page(
    'Apply to join Paws Hopez Society',
    `<p>Submit your details below. Your application will remain pending until a Society administrator verifies and approves it. Submitting this form does not create an ERP account or grant access.</p>
<form method="post" action="${action}">
  <p><label>Full name<br><input name="fullName" required minlength="2" maxlength="120" autocomplete="name"></label></p>
  <p><label>Email address<br><input name="email" type="email" required maxlength="180" autocomplete="email"></label></p>
  <p><label>Phone (optional)<br><input name="phone" maxlength="25" autocomplete="tel"></label></p>
  <p><label>Why would you like to join? (optional)<br><textarea name="message" maxlength="1000" rows="4"></textarea></label></p>
  <div hidden aria-hidden="true"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
  <p><button type="submit">Submit application</button></p>
</form>
<p>Only an authorised Super Admin can approve applications and assign ERP access.</p>`
  );
});

publicJoinRoutes.post('/:token', async (c) => {
  const token = c.req.param('token');
  const link = await findActiveLink(c, token);

  if (!link) {
    return page(
      'Invitation link unavailable',
      '<p>This join link is invalid, expired or has been revoked. Please contact Paws Hopez Society.</p>',
      404
    );
  }

  const contentType = c.req.header('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    return page('Invalid form submission', '<p>Please submit the application using the provided form.</p>', 415);
  }
  const contentLength = Number(c.req.header('Content-Length') || '0');
  if (Number.isFinite(contentLength) && contentLength > 16 * 1024) {
    return page('Form is too large', '<p>Please shorten your application and try again.</p>', 413);
  }
  const rawBody = await c.req.text();
  if (new TextEncoder().encode(rawBody).byteLength > 16 * 1024) {
    return page('Form is too large', '<p>Please shorten your application and try again.</p>', 413);
  }
  const params = new URLSearchParams(rawBody);
  const body: Record<string, string> = {
    website: params.get('website') || '',
    fullName: params.get('fullName') || '',
    email: params.get('email') || '',
    phone: params.get('phone') || '',
    message: params.get('message') || '',
  };
  const honeypot = typeof body.website === 'string' ? body.website.trim() : '';
  if (honeypot) {
    return page('Application received', '<p>Thank you. If your application is valid, it will be reviewed by an administrator.</p>');
  }

  const parsed = applicationSchema.safeParse({
    fullName: body.fullName,
    email: body.email,
    phone: body.phone,
    message: body.message,
  });

  if (!parsed.success) {
    return page(
      'Please check your details',
      '<p>Please provide a valid name and email address, then submit the form again.</p><p><a href="/api/v1/public/join/${encodeURIComponent(token)}">Return to the application form</a></p>',
      400
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  if (existingUser) {
    return page(
      'Application not submitted',
      '<p>This email is already associated with an ERP account or previous registration. Please contact the Society administrator for assistance.</p>'
    );
  }

  const duplicate = await c.env.DB.prepare(`
    SELECT id FROM join_applications
    WHERE email = ? AND status = 'pending'
  `).bind(email).first();

  if (duplicate) {
    return page(
      'Application already pending',
      '<p>An application using this email is already awaiting administrator review. Please do not submit it again.</p>'
    );
  }

  try {
    await c.env.DB.prepare(`
      INSERT INTO join_applications (
        id, join_link_id, full_name, email, phone, message
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      link.id,
      parsed.data.fullName,
      email,
      parsed.data.phone || null,
      parsed.data.message || null
    ).run();
  } catch {
    return page(
      'Application already pending',
      '<p>An application using this email may already be awaiting review. If you need help, contact the Society administrator.</p>'
    );
  }

  return page(
    'Application submitted',
    '<p>Thank you for your interest in Paws Hopez Society. Your application has been submitted and is pending administrator verification.</p><p>You will receive further instructions from the Society after review. This submission does not grant ERP access.</p>'
  );
});
