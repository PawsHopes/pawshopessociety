import React, { useEffect, useState } from 'react';
import { CheckCircle2, Database, Lock, PawPrint, ShieldAlert } from 'lucide-react';
import { apiFetch, type AuthUser } from '../lib/api';

interface Props {
  user: AuthUser;
}

type HealthStatus = 'checking' | 'online' | 'degraded';

type HealthResponse = {
  database: string;
  environment?: string;
  schema?: { ready: boolean; migrationsApplied: number; tableCount: number };
  storage?: { publicMedia: boolean; privateVault: boolean };
  timestamp: string;
};

export const FoundationDashboard: React.FC<Props> = ({ user }) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking');
  const [publicAnimalCount, setPublicAnimalCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<HealthResponse>('/api/v1/health')
      .then((res) => {
        if (!active) return;
        if (res.success && res.data?.database === 'ok' && res.data.schema?.ready) {
          setHealth(res.data);
          setHealthStatus('online');
        } else {
          setHealth(res.data || null);
          setHealthStatus('degraded');
        }
      })
      .catch(() => {
        if (active) setHealthStatus('degraded');
      });

    apiFetch<{ available: unknown[]; adopted: unknown[] }>('/api/v1/public/animals')
      .then((res) => {
        if (active && res.success && res.data) {
          setPublicAnimalCount(res.data.available.length + res.data.adopted.length);
        }
      })
      .catch(() => {
        if (active) setPublicAnimalCount(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const productionVerified = health?.environment === 'production' && health?.database === 'ok' && health?.schema?.ready === true;
  const storageReady = Boolean(health?.storage?.publicMedia && health?.storage?.privateVault);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brandOrange">
            ERP Foundation — {health?.environment === 'production' ? 'Production' : health?.environment === 'staging' ? 'Staging' : 'Environment checking'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Paw&apos;s Hopez Society — ERP Control Centre
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Bakshi Ka Talab, Lucknow &middot; &ldquo;Let them know.... Someone cares.&rdquo;
          </p>
        </div>
        <div className={`px-4 py-2 rounded-xl border text-xs font-bold ${productionVerified ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          {healthStatus === 'checking' ? 'Verifying production deployment…' : productionVerified ? 'Production API & schema verified' : health?.environment === 'production' ? 'Production schema verification pending' : 'Production deployment not verified'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Workers API</span>
            {healthStatus === 'online' ? <CheckCircle2 className="w-5 h-5 text-brandGreen" /> : <ShieldAlert className="w-5 h-5 text-amber-600" />}
          </div>
          <p className="text-xl font-extrabold mt-2">
            {healthStatus === 'online' ? 'Responding' : healthStatus === 'degraded' ? 'Unavailable / schema check failed' : 'Checking…'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Live API health and schema response</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Cloudflare D1</span>
            <Database className="w-5 h-5 text-brandOrange" />
          </div>
          <p className="text-xl font-extrabold mt-2">
            {health?.database === 'ok' ? 'Connected' : healthStatus === 'degraded' ? 'Unavailable' : 'Checking…'}
          </p>
          <p className="text-xs text-slate-500 mt-1">{health?.schema ? `${health.schema.migrationsApplied} migrations · ${health.schema.tableCount} tables` : 'Schema verification pending'}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Public Animal Listings</span>
            <PawPrint className="w-5 h-5 text-brandOrange" />
          </div>
          <p className="text-xl font-extrabold mt-2">
            {publicAnimalCount !== null ? publicAnimalCount.toLocaleString() : 'Not available'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Published and adopted records returned by the public API</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">R2 Document Storage</span>
            <Database className="w-5 h-5 text-brandOrange" />
          </div>
          <p className="text-xl font-extrabold mt-2">
            {storageReady ? 'Ready' : healthStatus === 'online' ? 'Not enabled' : 'Checking…'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Public media: {health?.storage?.publicMedia ? 'available' : 'disabled'} · Private vault: {health?.storage?.privateVault ? 'available' : 'disabled'}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Access &amp; RBAC</span>
            <Lock className="w-5 h-5 text-brandBlue" />
          </div>
          <p className="text-xl font-extrabold mt-2">{user.roleName}</p>
          <p className="text-xs text-slate-500 mt-1">{user.permissions.length} granular permissions loaded for this account</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">Release status</h2>
        <p className="mt-2 text-sm text-slate-600">
          {productionVerified
            ? 'Production API, database migrations and schema are verified. This is infrastructure verification only; each business workflow still needs functional acceptance testing before real Society records are entered.'
            : 'Production infrastructure verification is incomplete. Do not enter real donor, medical, financial, identity, or volunteer records until the production release gate is completed.'}
        </p>
        {health?.timestamp && <p className="mt-3 text-xs text-slate-400">Last health check: {new Date(health.timestamp).toLocaleString()}</p>}
      </div>
    </div>
  );
};
