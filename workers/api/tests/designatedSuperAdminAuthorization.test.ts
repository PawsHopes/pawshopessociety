import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppVariables, AuthUser, Bindings } from '../src/types/env';
import { isDesignatedSuperAdmin } from '../src/middleware/rbac';
import { adminModuleRoutes } from '../src/routes/admin/modules';
import { adminNotificationsRoutes } from '../src/routes/admin/notifications';
import { runDailyNotifications } from '../src/services/notifications';

vi.mock('../src/services/notifications', () => ({
  runDailyNotifications: vi.fn(async () => ({ createdCandidates: 0 })),
}));

const DESIGNATED_ADMINS = [
  { id: 'primary-admin', email: 'HOPEZPAWS@gmail.com' },
  { id: 'second-admin', email: 'InfoSecAyush@gmail.com' },
] as const;

function makeAdmin(id: string, email: string): AuthUser {
  return {
    id,
    email,
    fullName: 'Designated Society Super Admin',
    roleCode: 'super_admin',
    roleName: 'Super Admin',
    permissions: ['animals:write', 'medical:write'],
  };
}

function makeNotificationApp(actor: AuthUser) {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('authUser', actor);
    await next();
  });
  app.route('/notifications', adminNotificationsRoutes);
  return app;
}

function makeModuleApp(actor: AuthUser) {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('authUser', actor);
    await next();
  });
  app.route('/modules', adminModuleRoutes);
  return app;
}

function makeAttachmentEnv() {
  const executedStatements: string[] = [];
  const DB = {
    prepare(sql: string) {
      return {
        bind(..._values: unknown[]) {
          return {
            first: async () => {
              if (sql.includes('SELECT id FROM animals')) return { id: 'animal-1' };
              if (sql.includes('SELECT id FROM medical_records')) return { id: 'medical-1' };
              if (sql.includes('FROM media_assets')) return { id: 'media-1', uploaded_by: 'original-uploader' };
              if (sql.includes('FROM documents')) return { id: 'doc-1', uploaded_by: 'original-uploader' };
              if (sql.includes('SELECT COUNT(*) AS count FROM animal_media')) return { count: 0 };
              return null;
            },
            run: async () => {
              executedStatements.push(sql);
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  return { env: { DB } as unknown as Bindings, executedStatements };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('designated Society Super Admin identity', () => {
  it('recognizes both designated email addresses regardless of case and surrounding whitespace', () => {
    expect(isDesignatedSuperAdmin({ roleCode: 'super_admin', email: ' HOPEZPAWS@gmail.com ' })).toBe(true);
    expect(isDesignatedSuperAdmin({ roleCode: 'super_admin', email: 'InfoSecAyush@gmail.com' })).toBe(true);
  });

  it('does not grant designated-admin status to other emails or non-Super-Admin roles', () => {
    expect(isDesignatedSuperAdmin({ roleCode: 'super_admin', email: 'other@example.org' })).toBe(false);
    expect(isDesignatedSuperAdmin({ roleCode: 'auditor', email: 'infosecayush@gmail.com' })).toBe(false);
    expect(isDesignatedSuperAdmin(undefined)).toBe(false);
  });
});

for (const adminCase of DESIGNATED_ADMINS) {
  describe('authorization parity for ' + adminCase.email, () => {
    const actor = makeAdmin(adminCase.id, adminCase.email);

    it('allows the designated admin to trigger a manual notification run', async () => {
      const app = makeNotificationApp(actor);
      const response = await app.request('/notifications/run', { method: 'POST' }, {} as Bindings);

      expect(response.status).toBe(200);
      expect(vi.mocked(runDailyNotifications)).toHaveBeenCalledTimes(1);
    });

    it('allows the designated admin to attach another uploader\'s animal image', async () => {
      const app = makeModuleApp(actor);
      const { env, executedStatements } = makeAttachmentEnv();
      const response = await app.request(
        '/modules/attachments/animals/animal-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaAssetId: 'media-1', label: 'Rescue photo' }),
        },
        env,
      );

      expect(response.status).toBe(201);
      expect(executedStatements.some((sql) => sql.includes('INSERT INTO record_attachments'))).toBe(true);
    });

    it('allows the designated admin to attach another uploader\'s private document', async () => {
      const app = makeModuleApp(actor);
      const { env, executedStatements } = makeAttachmentEnv();
      const response = await app.request(
        '/modules/attachments/medical_records/medical-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'doc-1', label: 'Medical certificate' }),
        },
        env,
      );

      expect(response.status).toBe(201);
      expect(executedStatements.some((sql) => sql.includes('INSERT INTO record_attachments'))).toBe(true);
    });
  });
}

describe('non-designated Super Admin authorization', () => {
  const nonDesignatedAdmin = makeAdmin('other-admin', 'other@example.org');

  it('blocks manual notification execution even when the account has the Super Admin role', async () => {
    const app = makeNotificationApp(nonDesignatedAdmin);
    const response = await app.request('/notifications/run', { method: 'POST' }, {} as Bindings);

    expect(response.status).toBe(403);
    expect(vi.mocked(runDailyNotifications)).not.toHaveBeenCalled();
  });

  it('blocks cross-user media and document attachment by a non-designated Super Admin', async () => {
    const app = makeModuleApp(nonDesignatedAdmin);
    const { env, executedStatements } = makeAttachmentEnv();

    const imageResponse = await app.request(
      '/modules/attachments/animals/animal-1',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaAssetId: 'media-1' }),
      },
      env,
    );
    const documentResponse = await app.request(
      '/modules/attachments/medical_records/medical-1',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: 'doc-1' }),
      },
      env,
    );

    expect(imageResponse.status).toBe(403);
    expect(documentResponse.status).toBe(403);
    expect(executedStatements.some((sql) => sql.includes('INSERT INTO record_attachments'))).toBe(false);
  });
});
