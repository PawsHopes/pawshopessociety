import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { apiFetch, type AuthUser } from './lib/api';
import { Layout } from './Layout';
import { FoundationDashboard } from './pages/FoundationDashboard';
import { UsersPage } from './pages/UsersPage';
import { JoinManagementPage } from './pages/JoinManagementPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ModulePreviewPage } from './pages/ModulePreviewPage';
import { ModuleWorkspacePage } from './pages/ModuleWorkspacePage';
import { EmergencyDirectoryPage } from './pages/EmergencyDirectoryPage';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000;
const ABSOLUTE_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const SESSION_CHANNEL = 'paws-hopez-erp-session';

interface PermissionGateProps { user: AuthUser; permission: string; children: React.ReactNode; }
const PermissionGate: React.FC<PermissionGateProps> = ({ user, permission, children }) => {
  if (!user.permissions.includes(permission)) return (
    <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-slate-800">
      <h1 className="text-lg font-semibold">Access denied</h1>
      <p className="mt-2 text-sm">Your ERP role does not have permission to view this section.</p>
    </section>
  );
  return <>{children}</>;
};

export const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [sessionWarning, setSessionWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(IDLE_WARNING_MS / 1000);
  const logoutStarted = useRef(false);

  const logout = useCallback((reason: 'manual' | 'idle' | 'absolute' | 'remote' | 'invalid' = 'manual') => {
    if (logoutStarted.current) return;
    logoutStarted.current = true;
    try {
      if (reason !== 'remote') {
        const channel = new BroadcastChannel(SESSION_CHANNEL);
        channel.postMessage({ type: 'logout' });
        channel.close();
      }
    } catch { /* Cross-tab notification is optional; Access logout remains authoritative. */ }
    setUser(null);
    setAuthStatus('unauthenticated');
    const returnTo = window.location.origin + '/';
    window.location.replace('/cdn-cgi/access/logout?returnTo=' + encodeURIComponent(returnTo));
  }, []);

  const resumeSession = useCallback(async () => {
    const result = await apiFetch<AuthUser>('/api/v1/admin/me', { cache: 'no-store' });
    if (result.success && result.data) { setUser(result.data); setSessionWarning(false); return true; }
    logout('invalid');
    return false;
  }, [logout]);

  useEffect(() => {
    let active = true;
    const initializeSession = async () => {
      try {
        let res = await apiFetch<AuthUser>('/api/v1/admin/me', { cache: 'no-store' });
        if (!res.success && res.error?.code === 'FORBIDDEN' && res.error.message.toLowerCase().includes('not registered')) {
          const bootstrap = await apiFetch('/api/v1/admin/bootstrap/super-admin', { method: 'POST' });
          if (bootstrap.success) res = await apiFetch<AuthUser>('/api/v1/admin/me', { cache: 'no-store' });
        }
        if (!active) return;
        if (res.success && res.data) { setUser(res.data); setAuthStatus('authenticated'); }
        else { setUser(null); setAuthStatus('unauthenticated'); }
      } catch {
        if (!active) return;
        setUser(null); setAuthStatus('unauthenticated');
      }
    };
    void initializeSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) return;
    let idleTimer: ReturnType<typeof setTimeout>;
    let warningTimer: ReturnType<typeof setTimeout>;
    let countdownTimer: ReturnType<typeof setInterval>;
    let absoluteTimer: ReturnType<typeof setTimeout>;
    let heartbeatTimer: ReturnType<typeof setInterval>;
    let warningEndsAt = 0;
    let lastActivityAt = Date.now();
    let disposed = false;
    const clearIdleTimers = () => { clearTimeout(idleTimer); clearTimeout(warningTimer); clearInterval(countdownTimer); };
    const scheduleIdleTimeout = () => {
      clearIdleTimers();
      setSessionWarning(false);
      idleTimer = setTimeout(() => {
        if (disposed) return;
        warningEndsAt = Date.now() + IDLE_WARNING_MS;
        setSecondsRemaining(IDLE_WARNING_MS / 1000);
        setSessionWarning(true);
        countdownTimer = setInterval(() => setSecondsRemaining(Math.max(0, Math.ceil((warningEndsAt - Date.now()) / 1000))), 1000);
        warningTimer = setTimeout(() => logout('idle'), IDLE_WARNING_MS);
      }, IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
    };
    const onActivity = () => { if (!disposed) { lastActivityAt = Date.now(); scheduleIdleTimeout(); } };
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS) logout('idle');
    };
    let channel: BroadcastChannel | undefined;
    try { channel = new BroadcastChannel(SESSION_CHANNEL); channel.onmessage = (event) => { if (event.data?.type === 'logout') logout('remote'); }; }
    catch { channel = undefined; }
    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    absoluteTimer = setTimeout(() => logout('absolute'), ABSOLUTE_SESSION_TIMEOUT_MS);
    heartbeatTimer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const result = await apiFetch<AuthUser>('/api/v1/admin/me', { cache: 'no-store' });
      if (!result.success || !result.data) logout('invalid');
      else setUser(result.data);
    }, 60 * 1000);
    scheduleIdleTimeout();
    return () => {
      disposed = true; clearIdleTimers(); clearTimeout(absoluteTimer); clearInterval(heartbeatTimer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      document.removeEventListener('visibilitychange', onVisibility); channel?.close();
    };
  }, [authStatus, user?.id, logout]);

  const continueSession = async () => {
    if (await resumeSession()) window.dispatchEvent(new Event('mousemove'));
  };

  if (authStatus === 'checking') return <main className="min-h-screen grid place-items-center bg-[#fdfbf7] p-6"><p role="status" className="text-sm text-slate-600">Verifying your Cloudflare Access session…</p></main>;
  if (authStatus === 'unauthenticated' || !user) return (
    <main className="min-h-screen grid place-items-center bg-[#fdfbf7] p-6">
      <section role="alert" className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">ERP sign-in required</h1>
        <p className="mt-3 text-sm text-slate-600">Your Cloudflare Access session could not be verified. Sign in through the organisation's Access login page, then retry.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Retry authentication</button>
      </section>
    </main>
  );

  return (
    <BrowserRouter>
      <Layout user={user} onLogout={() => logout('manual')}>
        {sessionWarning && <div role="alertdialog" aria-modal="true" aria-labelledby="session-timeout-title" className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="session-timeout-title" className="text-lg font-bold text-slate-900">Session about to expire</h2>
            <p className="mt-2 text-sm text-slate-600">You have been inactive. For your security, you will be signed out in {secondsRemaining} seconds.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => logout('manual')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Log out now</button>
              <button type="button" onClick={() => void continueSession()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Continue session</button>
            </div>
          </section>
        </div>}
        <Routes>
          <Route path="/" element={<PermissionGate user={user} permission="dashboard:read"><FoundationDashboard user={user} /></PermissionGate>} />
          <Route path="/users" element={<PermissionGate user={user} permission="users:manage"><UsersPage currentUserId={user.id} /></PermissionGate>} />
          <Route path="/join-requests" element={<PermissionGate user={user} permission="users:manage"><JoinManagementPage /></PermissionGate>} />
          <Route path="/audit-logs" element={<PermissionGate user={user} permission="audit:read"><AuditLogsPage /></PermissionGate>} />
          <Route path="/emergency-directory" element={<PermissionGate user={user} permission="rescue:read"><EmergencyDirectoryPage /></PermissionGate>} />
          <Route path="/modules/:moduleKey" element={<ModuleWorkspacePage user={user} />} />
          <Route path="/roadmap/:moduleKey" element={<ModulePreviewPage user={user} />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};
export default App;
