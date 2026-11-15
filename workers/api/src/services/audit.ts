import type { Context } from 'hono';
import type { Bindings, AppVariables } from '../types/env';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

export async function appendAuditLog(
  c: Context<{ Bindings: Bindings; Variables: AppVariables }>,
  entry: AuditEntry
): Promise<void> {
  const actor = c.get('authUser');
  const ip = c.req.header('CF-Connecting-IP') || null;
  const ua = c.req.header('User-Agent') || null;

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (
      id, actor_user_id, actor_email, action, entity_type, entity_id,
      before_json, after_json, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      actor?.id ?? null,
      actor?.email ?? c.get('authEmail') ?? 'system',
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.before !== undefined ? JSON.stringify(entry.before) : null,
      entry.after !== undefined ? JSON.stringify(entry.after) : null,
      ip,
      ua
    )
    .run();
}
