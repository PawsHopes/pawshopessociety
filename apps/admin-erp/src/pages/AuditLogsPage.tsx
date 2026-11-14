import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface AuditRow {
  id: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  afterJson: string | null;
  createdAt: string;
}

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditRow[]>([]);

  useEffect(() => {
    apiFetch<AuditRow[]>('/api/v1/admin/audit-logs?limit=100').then((res) => {
      if (res.success && res.data) setLogs(res.data);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Immutable System Audit Trail</h1>
        <p className="text-sm text-slate-600">
          Append-only security &amp; compliance log protected by database triggers.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 uppercase text-slate-500">
            <tr>
              <th className="p-3.5">Timestamp (UTC)</th>
              <th className="p-3.5">Actor</th>
              <th className="p-3.5">Action</th>
              <th className="p-3.5">Entity</th>
              <th className="p-3.5">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  No audit events recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="p-3.5 font-mono text-slate-500">{l.createdAt}</td>
                  <td className="p-3.5 font-semibold text-slate-800">{l.actorEmail}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                      {l.action}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-slate-600">
                    {l.entityType}:{l.entityId.slice(0, 8)}
                  </td>
                  <td className="p-3.5 font-mono text-slate-500 max-w-xs truncate">
                    {l.afterJson || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
