import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: string;
  roleCode: string;
  roleName: string;
}

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string;
}

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleCode, setRoleCode] = useState('auditor');
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = () => {
    apiFetch<{ users: UserRow[]; roles: RoleRow[] }>('/api/v1/admin/users').then((res) => {
      if (res.success && res.data) {
        setUsers(res.data.users);
        setRoles(res.data.roles);
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await apiFetch('/api/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, fullName, roleCode }),
    });
    if (res.success) {
      setEmail('');
      setFullName('');
      setFeedback('User created and recorded in audit log.');
      load();
    } else {
      setFeedback(`Error: ${res.error?.message || 'Failed to create user'}`);
    }
  };

  const toggleStatus = async (u: UserRow) => {
    const nextStatus = u.status === 'active' ? 'suspended' : 'active';
    const res = await apiFetch(`/api/v1/admin/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.success) {
      load();
    } else {
      setFeedback(`Error: ${res.error?.message || 'Action blocked'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">User Management &amp; RBAC</h1>
        <p className="text-sm text-slate-600">
          Assign roles and enforce least-privilege access across NGO staff and volunteers.
        </p>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          New ERP accounts also need their email added to the Cloudflare Access allowlist before they can sign in. Creating an ERP user alone does not grant website access.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
      >
        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Full Name</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Dr. Priya Verma"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vet@pawshopessociety.org"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Role</label>
          <select
            value={roleCode}
            onChange={(e) => setRoleCode(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          >
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-brandOrange hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-colors"
        >
          + Add ERP User
        </button>
      </form>

      {feedback && (
        <div className="p-3 rounded-xl bg-slate-900 text-white text-xs font-medium">{feedback}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Email</th>
              <th className="p-4">Role</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="p-4 font-semibold text-slate-900">{u.fullName}</td>
                <td className="p-4 text-slate-600">{u.email}</td>
                <td className="p-4">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-brandOrange">
                    {u.roleName}
                  </span>
                </td>
                <td className="p-4">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      u.status === 'active'
                        ? 'bg-green-100 text-brandGreen'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => toggleStatus(u)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100"
                  >
                    {u.status === 'active' ? 'Suspend' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
