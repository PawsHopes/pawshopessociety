import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings, AppVariables } from './types/env';
import { securityHeaders } from './middleware/securityHeaders';
import { cfAccessAuth } from './middleware/cfAccessAuth';
import { loadRbacUser } from './middleware/rbac';
import { healthRoutes } from './routes/health';
import { publicAnimalsRoutes } from './routes/public/animals';
import { publicJoinRoutes } from './routes/public/join';
import { adminMeRoutes } from './routes/admin/me';
import { adminUsersRoutes } from './routes/admin/users';
import { adminJoinRoutes } from './routes/admin/join';
import { adminDocumentRoutes, publicFileProxyRoutes } from './routes/admin/documents';
import { adminAuditLogRoutes } from './routes/admin/auditLogs';

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

app.use('*', securityHeaders);

app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      if (!origin) return c.env.PUBLIC_SITE_ORIGIN;
      const allowed = [c.env.PUBLIC_SITE_ORIGIN, c.env.ADMIN_ERP_ORIGIN];
      if (c.env.ENVIRONMENT === 'development') {
        allowed.push('http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8788');
      }
      return allowed.includes(origin) ? origin : '';
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cf-Access-Jwt-Assertion', 'X-Dev-User-Email'],
    maxAge: 86400,
  })
);

// Public endpoints
app.route('/api/v1/health', healthRoutes);
app.route('/api/v1/public/animals', publicAnimalsRoutes);
app.route('/api/v1/public/join', publicJoinRoutes);
app.route('/api/v1/files', publicFileProxyRoutes);

// Protected Admin ERP endpoints
app.use('/api/v1/admin/*', cfAccessAuth, loadRbacUser);
app.route('/api/v1/admin/me', adminMeRoutes);
app.route('/api/v1/admin/users', adminUsersRoutes);
app.route('/api/v1/admin/join', adminJoinRoutes);
app.route('/api/v1/admin', adminDocumentRoutes);
app.route('/api/v1/admin/audit-logs', adminAuditLogRoutes);

app.notFound((c) =>
  c.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Requested API route does not exist.' } },
    404
  )
);

app.onError((err, c) => {
  console.error('Unhandled API Error:', err);
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected server error occurred.',
      },
    },
    500
  );
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) {
    console.log('Running daily NGO ERP alert check in environment:', env.ENVIRONMENT);
  },
};
