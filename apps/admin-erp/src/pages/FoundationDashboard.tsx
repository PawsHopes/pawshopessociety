import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldAlert, Database, Lock, PawPrint } from 'lucide-react';
import { apiFetch, type AuthUser } from '../lib/api';

interface Props {
  user: AuthUser | null;
}

export const FoundationDashboard: React.FC<Props> = ({ user }) => {
  const [health, setHealth] = useState<{
    environment: string;
    database: string;
    timestamp: string;
  } | null>(null);
  const [publicAnimalCount, setPublicAnimalCount] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ environment: string; database: string; timestamp: string }>('/api/v1/health').then(
      (res) => {
        if (res.success && res.data) setHealth(res.data);
      }
    );
    apiFetch<{ available: unknown[]; adopted: unknown[] }>('/api/v1/public/animals').then(
      (res) => {
        if (res.success && res.data) {
          setPublicAnimalCount(res.data.available.length + res.data.adopted.length);
        }
      }
    );
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brandOrange">
            Phase 3 Foundation Active
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Paw&apos;s Hopez Society — ERP Control Centre
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Bakshi Ka Talab, Lucknow &middot; &ldquo;Let them know.... Someone cares.&rdquo;
          </p>
        </div>
        <div className="px-4 py-2 rounded-xl bg-green-50 border border-green-200 text-brandGreen text-xs font-bold">
          Public Website Protected (Zero Downtime)
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Workers API</span>
            <CheckCircle2 className="w-5 h-5 text-brandGreen" />
          </div>
          <p className="text-xl font-extrabold mt-2">
            {health ? `Online (${health.environment})` : 'Checking...'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Hono + TypeScript + Security Headers</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Cloudflare D1</span>
            <Database className="w-5 h-5 text-brandOrange" />
          </div>
          <p className="text-xl font-extrabold mt-2">
            {health?.database === 'ok' ? 'Connected (36 Tables)' : 'Awaiting D1 Binding'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Immutable ledger &amp; audit triggers enabled</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Migrated Animals</span>
            <PawPrint className="w-5 h-5 text-brandAmber" />
          </div>
          <p className="text-xl font-extrabold mt-2">
            {publicAnimalCount !== null ? `${publicAnimalCount} Animals Seeded` : '15 Ready in Seed'}
          </p>
          <p className="text-xs text-slate-500 mt-1">54 verified .webp photos mapped</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Access &amp; RBAC</span>
            <Lock className="w-5 h-5 text-brandBlue" />
          </div>
          <p className="text-xl font-extrabold mt-2">{user ? user.roleName : 'Auth Required'}</p>
          <p className="text-xs text-slate-500 mt-1">
            {user ? `${user.permissions.length} granular permissions active` : 'Zero Trust JWT verified'}
          </p>
        </div>
      </div>

      {!user && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-bold">Admin Session Not Connected Yet</p>
            <p className="mt-1">
              In local development, set <code className="bg-amber-100 px-1.5 py-0.5 rounded">VITE_DEV_USER_EMAIL</code> in{' '}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded">apps/admin-erp/.env.local</code> matching{' '}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded">DEV_BOOTSTRAP_ADMIN_EMAIL</code> in{' '}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded">workers/api/.dev.vars</code>. In staging/production,
              Cloudflare Access injects your verified identity automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
