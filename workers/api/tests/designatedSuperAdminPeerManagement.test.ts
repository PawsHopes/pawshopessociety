import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppVariables, AuthUser, Bindings } from '../src/types/env';

vi.mock('../src/services/audit', () => ({
  appendAuditLog: vi.fn(async () => undefined),
}));

vi.mock('../src/services/cloudflareAccess', () => ({
  revokeEmailFromCloudflareAccess: vi.fn(async () => ({ status: 'synced', message: 'Removed from Access.' })),
  syncApprovedEmailToCloudflareAccess: vi.fn(async () => ({ status: 'synced', message: 'Added to Access.' })),
}));

import { adminUsersRoutes } from '../src/routes/admin/users';
import { revokeEmailFromCloudflareAccess } from '../src/services/cloudflareAccess';

const ADMINS = [
  { id: 'admin-hope', email: 'hopezpaws@gmail.com', peerId: 'admin-ayush', peerEmail: 'infosecayush@gmail.com' },
  { id: 'admin-ayush', email: 'infosecayush@gmail.com', peerId: 'admin-hope', peerEmail: 'hopezpaws@gmail.com' },
] as const;

function makeApp(actor: AuthUser, peer: { id: string; email: string }) {
  const updates: Array<{ sql: string; values: unknown[] }> = [];
  const DB = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            first: async () => {
              if (sql.includes('SELECT u.id, u.email, u.full_name, u.phone')) {
                return {
                  id: peer.id,
                  email: peer.email,
                  full_name: 'Peer Admin',
                  phone: null,
                  status: 'active',
                  role_id: 'role_super_admin',
                  role_code: 'super_admin',
                };
              }
              if (sql.includes('SELECT COUNT(*) AS count')) return { count: 2 };
              if (sql.includes('SELECT u.role_id, u.status, r.code as role_code')) {
                return { role_id: 'role_super_admin', role_code: 'super_admin', status: 'suspended' };
              }
              return null;
            },
            run: async () => {
              updates.push({ sql, values });
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };

  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('authUser', actor);
    await next();
  });
  app.route('/users', adminUsersRoutes);
  return { app, env: { DB } as unknown as Bindings, updates };
}

beforeEach(() => vi.clearAllMocks());

describe('equal designated Society Super Admin peer management', () => {
  it.each(ADMINS)('$email can suspend the other designated Super Admin', async (actorCase) => {
    const actor: AuthUser = {
      id: actorCase.id,
      email: actorCase.email,
      fullName: 'Society Super Admin',
      roleCode: 'super_admin',
      roleName: 'Super Admin',
      permissions: ['users:manage'],
    };
    const { app, env, updates } = makeApp(actor, {
      id: actorCase.peerId,
      email: actorCase.peerEmail,
    });

    const response = await app.request(
      '/users/' + actorCase.peerId,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      },
      env,
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as { success: boolean; data: { roleCode: string; status: string } };
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual({ id: actorCase.peerId, updated: true, roleCode: 'super_admin', status: 'suspended', accessSyncStatus: 'synced', accessSyncMessage: 'Removed from Access.' });
    expect(updates.some((entry) => entry.sql.includes('UPDATE users SET'))).toBe(true);
    expect(revokeEmailFromCloudflareAccess).toHaveBeenCalledWith(expect.anything(), actorCase.peerEmail);
  });

  it.each(ADMINS)('$email cannot suspend its own account', async (actorCase) => {
    const actor: AuthUser = {
      id: actorCase.id,
      email: actorCase.email,
      fullName: 'Society Super Admin',
      roleCode: 'super_admin',
      roleName: 'Super Admin',
      permissions: ['users:manage'],
    };
    const { app, env, updates } = makeApp(actor, {
      id: actorCase.id,
      email: actorCase.email,
    });

    const response = await app.request(
      '/users/' + actorCase.id,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      },
      env,
    );

    expect(response.status).toBe(403);
    expect(updates).toHaveLength(0);
    expect(revokeEmailFromCloudflareAccess).not.toHaveBeenCalled();
  });
});
