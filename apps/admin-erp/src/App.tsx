import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { apiFetch, type AuthUser } from './lib/api';
import { Layout } from './Layout';
import { FoundationDashboard } from './pages/FoundationDashboard';
import { UsersPage } from './pages/UsersPage';
import { JoinManagementPage } from './pages/JoinManagementPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ModulePreviewPage } from './pages/ModulePreviewPage';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface PermissionGateProps {
  user: AuthUser;
  permission: string;
  children: React.ReactNode;
}

const PermissionGate: React.FC<PermissionGateProps> = ({ user, permission, children }) => {
  if (!user.permissions.includes(permission)) {
    return (
      <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-slate-800">
        <h1 className="text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm">Your ERP role does not have permission to view this section.</p>
      </section>
    );
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');

  useEffect(() => {
    let active = true;
    apiFetch<AuthUser>('/api/v1/admin/me')
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          setUser(res.data);
          setAuthStatus('authenticated');
        } else {
          setUser(null);
          setAuthStatus('unauthenticated');
        }
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setAuthStatus('unauthenticated');
      });
    return () => {
      active = false;
    };
  }, []);

  if (authStatus === 'checking') {
    return (
      <main className="min-h-screen grid place-items-center bg-[#fdfbf7] p-6">
        <p role="status" className="text-sm text-slate-600">Verifying your Cloudflare Access session…</p>
      </main>
    );
  }

  if (authStatus === 'unauthenticated' || !user) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#fdfbf7] p-6">
        <section role="alert" className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">ERP sign-in required</h1>
          <p className="mt-3 text-sm text-slate-600">
            Your Cloudflare Access session could not be verified. Sign in through the organisation's Access login page, then retry.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Retry authentication
          </button>
        </section>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Layout user={user}>
        <Routes>
          <Route path="/" element={<PermissionGate user={user} permission="dashboard:read"><FoundationDashboard user={user} /></PermissionGate>} />
          <Route path="/users" element={<PermissionGate user={user} permission="users:manage"><UsersPage /></PermissionGate>} />
          <Route path="/join-requests" element={<PermissionGate user={user} permission="users:manage"><JoinManagementPage /></PermissionGate>} />
          <Route path="/audit-logs" element={<PermissionGate user={user} permission="audit:read"><AuditLogsPage /></PermissionGate>} />
          <Route path="/roadmap/:moduleKey" element={<ModulePreviewPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
