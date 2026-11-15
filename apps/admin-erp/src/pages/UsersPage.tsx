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
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [userDrafts, setUserDrafts] = useState<Record<string, { fullName: string; phone: string; roleCode: string }>>({});
  const [roleCode, setRoleCode] = useState('auditor');
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = () => {
    apiFetch<{ users: UserRow[]; roles: RoleRow[]; canManageRoles: boolean }>('/api/v1/admin/users').then((res) => {
      if (res.success && res.data) {
        setUsers(res.data.users);
        setRoles(res.data.roles);
        setCanManageRoles(res.data.canManageRoles === true);
        setUserDrafts(Object.fromEntries(res.data.users.map((u) => [u.id, { fullName: u.fullName, phone: u.phone || '', roleCode: u.roleCode }])));
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
      body: JSON.stringify({ email, fullName, phone: phone.trim() || null, roleCode }),
    });
    if (res.success) {
      setEmail('');
      setFullName('');
      setPhone('');
      setFeedback('User created and recorded in audit log.');
      load();
    } else {
      setFeedback(`Error: ${res.error?.message || 'Failed to create user'}`);
    }
  };

  const updateUser = async (u: UserRow) => {
    const draft = userDrafts[u.id] || { fullName: u.fullName, phone: u.phone || '', roleCode: u.roleCode };
    const res = await apiFetch(`/api/v1/admin/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fullName: draft.fullName,
        phone: draft.phone.trim() || null,
        ...(draft.roleCode !== u.roleCode ? { roleCode: draft.roleCode } : {}),
      }),
    });
    if (res.success) {
      setFeedback(`Updated ${draft.fullName}'s account details and role.`);
      load();
    } else {
      setFeedback(`Error: ${res.error?.message || 'Could not update user'}`);
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
        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 items-end"
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
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Phone (optional)</label>
          <input
            type="tel"
            maxLength={25}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
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
            {roles.filter((r) => r.code !== 'super_admin' || canManageRoles).map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!canManageRoles}
          title={!canManageRoles ? 'Only the designated Society administrator can create users and assign roles.' : undefined}
          className="bg-brandOrange hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
              <th className="p-4">Phone</th>
              <th className="p-4">Role</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="p-4"><input value={userDrafts[u.id]?.fullName ?? u.fullName} minLength={2} maxLength={120} onChange={(e) => setUserDrafts((old) => ({ ...old, [u.id]: { ...(old[u.id] || { fullName: u.fullName, phone: u.phone || '', roleCode: u.roleCode }), fullName: e.target.value } }))} className="w-44 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></td>
                <td className="p-4 text-slate-600">{u.email}</td>
                <td className="p-4"><input value={userDrafts[u.id]?.phone ?? u.phone ?? ''} maxLength={25} onChange={(e) => setUserDrafts((old) => ({ ...old, [u.id]: { ...(old[u.id] || { fullName: u.fullName, phone: u.phone || '', roleCode: u.roleCode }), phone: e.target.value } }))} className="w-36 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></td>
                <td className="p-4">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-brandOrange">
                    {roles.length ? <select value={userDrafts[u.id]?.roleCode ?? u.roleCode} onChange={(e) => setUserDrafts((old) => ({ ...old, [u.id]: { ...(old[u.id] || { fullName: u.fullName, phone: u.phone || '', roleCode: u.roleCode }), roleCode: e.target.value } }))} disabled={!canManageRoles || u.email.toLowerCase() === 'hopezpaws@gmail.com'} title={u.email.toLowerCase() === 'hopezpaws@gmail.com' ? 'Protected primary administrator account.' : (!canManageRoles ? 'Only the designated Society administrator can change roles.' : undefined)} className="max-w-48 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:bg-slate-100">{!roles.some((role) => role.code === u.roleCode) && (
                    <option value={u.roleCode}>{u.roleName}</option>
                  )}
                  {roles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select> : u.roleName}
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
                  <div className="flex justify-end gap-2">
                  <button onClick={() => updateUser(u)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white">Save</button>
                  <button
                    onClick={() => toggleStatus(u)}
                    disabled={!canManageRoles || u.email.toLowerCase() === 'hopezpaws@gmail.com'}
                    title={u.email.toLowerCase() === 'hopezpaws@gmail.com' ? 'Protected primary administrator account.' : (!canManageRoles ? 'Only the designated Society administrator can suspend or reactivate users.' : undefined)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {u.email.toLowerCase() === 'hopezpaws@gmail.com' ? 'Protected' : (u.status === 'active' ? 'Suspend' : 'Activate')}
                  </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
