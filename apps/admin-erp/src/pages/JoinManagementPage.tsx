import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type JoinLink = {
  id: string;
  label: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  applicationCount: number;
  pendingCount: number;
};

type JoinApplication = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  linkLabel: string;
};

const ROLES = [
  { code: 'finance_manager', label: 'Finance Manager' },
  { code: 'vet_staff', label: 'Veterinary / Medical Staff' },
  { code: 'rescue_coord', label: 'Rescue Coordinator' },
  { code: 'adoption_coord', label: 'Adoption Coordinator' },
  { code: 'volunteer', label: 'Volunteer' },
  { code: 'auditor', label: 'Auditor' },
];

export const JoinManagementPage: React.FC = () => {
  const [links, setLinks] = useState<JoinLink[]>([]);
  const [applications, setApplications] = useState<JoinApplication[]>([]);
  const [label, setLabel] = useState("Paws Hopes Society — Join");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [newLink, setNewLink] = useState('');
  const [roleByApplication, setRoleByApplication] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [accessEmailToAdd, setAccessEmailToAdd] = useState('');

  const load = async () => {
    const [linkRes, appRes] = await Promise.all([
      apiFetch<JoinLink[]>('/api/v1/admin/join/links'),
      apiFetch<JoinApplication[]>('/api/v1/admin/join/applications?status=pending'),
    ]);
    if (linkRes.success && linkRes.data) setLinks(linkRes.data);
    if (appRes.success && appRes.data) setApplications(appRes.data);
  };

  useEffect(() => {
    void load();
  }, []);

  const createLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFeedback('');
    const result = await apiFetch<{ joinUrl: string }>('/api/v1/admin/join/links', {
      method: 'POST',
      body: JSON.stringify({ label, expiresInDays }),
    });
    setBusy(false);
    if (result.success && result.data) {
      setNewLink(result.data.joinUrl);
      setFeedback('Join link created. Share this link with applicants.');
      await load();
    } else {
      setFeedback(result.error?.message || 'Could not create join link.');
    }
  };

  const copyLink = async () => {
    if (!newLink) return;
    try {
      await navigator.clipboard.writeText(newLink);
      setFeedback('Join link copied.');
    } catch {
      window.prompt('Copy this join link:', newLink);
    }
  };

  const revokeLink = async (id: string) => {
    if (!window.confirm('Revoke this link? New applications will no longer be accepted.')) return;
    const result = await apiFetch(`/api/v1/admin/join/links/${id}/revoke`, { method: 'POST' });
    setFeedback(result.success ? 'Join link revoked.' : result.error?.message || 'Could not revoke link.');
    await load();
  };

  const approve = async (application: JoinApplication) => {
    const roleCode = roleByApplication[application.id] || 'volunteer';
    if (!window.confirm(`Approve ${application.fullName} as ${roleCode.replaceAll('_', ' ')}? This will create an active ERP account.`)) return;

    const result = await apiFetch(`/api/v1/admin/join/applications/${application.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ roleCode }),
    });
    if (result.success) setAccessEmailToAdd(application.email);
    setFeedback(result.success ? `${application.fullName} approved. Their ERP account is active${roleCode === 'volunteer' ? ' and a volunteer registry profile was created' : ''}. Complete the Cloudflare Access step below before they sign in.` : result.error?.message || 'Approval failed.');
    await load();
  };

  const reject = async (application: JoinApplication) => {
    const reason = window.prompt(`Optional reason for rejecting ${application.fullName}:`) || '';
    const result = await apiFetch(`/api/v1/admin/join/applications/${application.id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    setFeedback(result.success ? 'Application rejected.' : result.error?.message || 'Rejection failed.');
    await load();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">Join Requests &amp; Verification</h1>
        <p className="mt-1 text-sm text-slate-600">
          Anyone with a valid link can apply. Only you, as Super Admin, can approve an applicant and assign ERP access.
        </p>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Approval creates the ERP account. You must separately add each approved email to Cloudflare Access before that person can sign in.
        </p>
      </header>

      {feedback && <div role="status" className="rounded-xl bg-slate-900 p-3 text-sm text-white">{feedback}</div>}

      {accessEmailToAdd && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5" aria-labelledby="access-setup-title">
          <h2 id="access-setup-title" className="text-base font-extrabold text-amber-950">One last step: grant Cloudflare Access</h2>
          <p className="mt-1 text-sm text-amber-900">This applicant is approved in Paws Hopes Society ERP, but Cloudflare Access still blocks sign-in until their exact email is added.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900">{accessEmailToAdd}</code>
            <button type="button" onClick={() => { void navigator.clipboard.writeText(accessEmailToAdd).then(() => setFeedback('Applicant email copied.')).catch(() => setFeedback('Copy failed. Please select and copy the email manually.')); }} className="rounded-lg border border-amber-400 px-3 py-2 text-sm font-bold text-amber-950">Copy email</button>
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-amber-950">
            <li>Open Cloudflare Dashboard → Zero Trust → Access → Applications.</li>
            <li>Open <strong>Paws Hopes Society Admin ERP</strong> and select its Allow policy.</li>
            <li>Under Include, add this exact email address as an Email rule. Keep the existing owner email.</li>
            <li>Save the policy. The applicant can then open the ERP and authenticate using this same email.</li>
          </ol>
          <p className="mt-3 text-xs text-amber-900">Do not add pending or rejected applicants. Do not use an Everyone or whole-domain rule.</p>
          <button type="button" onClick={() => setAccessEmailToAdd('')} className="mt-3 text-xs font-semibold text-amber-950 underline">Dismiss instructions</button>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Create a shareable join link</h2>
        <form onSubmit={createLink} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Link label
            <input value={label} onChange={(e) => setLabel(e.target.value)} required minLength={2} maxLength={100}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Expires in
            <select value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <div className="flex items-end">
            <button disabled={busy} className="w-full rounded-lg bg-orange-600 px-4 py-2.5 font-bold text-white disabled:opacity-50">
              {busy ? 'Creating…' : 'Create join link'}
            </button>
          </div>
        </form>

        {newLink && (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3">
            <p className="text-sm font-semibold text-slate-800">Share this link. It is shown only when created.</p>
            <p className="mt-2 break-all text-sm text-slate-700">{newLink}</p>
            <button onClick={copyLink} className="mt-3 rounded-lg border border-orange-300 px-3 py-2 text-sm font-bold text-orange-800">
              Copy join link
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Applications awaiting your verification ({applications.length})</h2>
        {applications.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No pending applications.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {applications.map((application) => (
              <article key={application.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col justify-between gap-2 md:flex-row">
                  <div>
                    <h3 className="font-bold text-slate-900">{application.fullName}</h3>
                    <p className="text-sm text-slate-600">{application.email}{application.phone ? ` · ${application.phone}` : ''}</p>
                    <p className="mt-1 text-xs text-slate-500">Link: {application.linkLabel} · Submitted: {new Date(application.submittedAt).toLocaleString()}</p>
                  </div>
                  <span className="h-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Pending verification</span>
                </div>
                {application.message && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{application.message}</p>}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <select aria-label={`Role for ${application.fullName}`} value={roleByApplication[application.id] || 'volunteer'}
                    onChange={(e) => setRoleByApplication((old) => ({ ...old, [application.id]: e.target.value }))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    {ROLES.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}
                  </select>
                  <button onClick={() => approve(application)} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white">Verify &amp; approve</button>
                  <button onClick={() => reject(application)} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-700">Reject</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Join links</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-xs uppercase text-slate-500">
              <th className="p-2">Label</th><th className="p-2">Applications</th><th className="p-2">Pending</th><th className="p-2">Expires</th><th className="p-2">Status</th><th className="p-2">Action</th>
            </tr></thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id} className="border-b border-slate-100">
                  <td className="p-2 font-medium">{link.label}</td>
                  <td className="p-2">{link.applicationCount}</td>
                  <td className="p-2">{link.pendingCount}</td>
                  <td className="p-2">{link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'Never'}</td>
                  <td className="p-2">{link.revokedAt ? 'Revoked' : 'Active'}</td>
                  <td className="p-2">
                    {!link.revokedAt && <button onClick={() => revokeLink(link.id)} className="text-xs font-bold text-red-700 underline">Revoke</button>}
                  </td>
                </tr>
              ))}
              {links.length === 0 && <tr><td colSpan={6} className="p-3 text-slate-500">No join links created yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
