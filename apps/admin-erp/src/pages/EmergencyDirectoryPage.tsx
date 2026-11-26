import React, { useMemo, useState } from 'react';
import { Search, Phone, MessageCircle, MapPin, Users, Download } from 'lucide-react';
import { emergencyContacts } from '../data/emergencyContacts';

export const EmergencyDirectoryPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('All districts');
  const [category, setCategory] = useState('All services');

  const districts = useMemo(() => ['All districts', ...Array.from(new Set(emergencyContacts.map((c) => c.district))).sort()], []);
  const categories = useMemo(() => ['All services', ...Array.from(new Set(emergencyContacts.map((c) => c.category))).sort()], []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return emergencyContacts.filter((c) => {
      const matchesQuery = !q || [c.name, c.district, c.locality, c.category, ...c.phones].join(' ').toLowerCase().includes(q);
      return matchesQuery && (district === 'All districts' || c.district === district) && (category === 'All services' || c.category === category);
    }).sort((a, b) => a.district.localeCompare(b.district) || a.name.localeCompare(b.name));
  }, [query, district, category]);

  const exportCsv = () => {
    const rows = [['Name', 'Phone numbers', 'District', 'Locality', 'Service category', 'Verification status'],
      ...filtered.map((c) => [c.name, c.phones.join(' / '), c.district, c.locality, c.category, 'Unverified — confirm before dispatch'])];
    const csv = rows.map((row) => row.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'paws-hopez-emergency-directory.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Paw&apos;s Hopez Society · Operations</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Emergency contact directory</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Rescue volunteers, NGOs, veterinary contacts, transport and specialist help, grouped by district and locality.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <Download className="h-4 w-4" /> Export filtered CSV
        </button>
      </div>

      <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Important:</strong> These 85 entries were imported from contact cards in the supplied WhatsApp export. This first import does not yet include every number mentioned only in free-text chat messages. Phone numbers and availability have not been independently verified. Districts are only assigned where the contact card explicitly indicates a location; otherwise they appear under “Unverified”. Confirm the person, service and current number before dispatching a rescue.
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_220px_240px]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Search name, phone, locality or service</span>
          <span className="flex items-center gap-2 rounded-lg border border-slate-300 px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Jankipuram, paravet, 98..." className="h-11 w-full border-0 bg-transparent text-sm outline-none focus:ring-0" />
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">District</span>
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
            {districts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Service type</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" /> {filtered.length} of {emergencyContacts.length} contacts</span>
        <button onClick={() => { setQuery(''); setDistrict('All districts'); setCategory('All services'); }} className="font-semibold text-orange-700 hover:underline">Clear filters</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((contact, index) => (
          <article key={contact.name + contact.phones.join('-') + index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold leading-snug text-slate-900">{contact.name}</h2>
                <p className="mt-1 text-xs text-slate-500">{contact.category}</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800">Unverified</span>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600"><MapPin className="h-3.5 w-3.5" /> {contact.district}{contact.locality ? ' · ' + contact.locality : ''}</p>
            <div className="mt-3 space-y-2">
              {contact.phones.map((phone) => {
                const digits = phone.replace(/\D/g, '');
                const whatsappNumber = digits.startsWith('91') ? digits : '91' + digits;
                return (
                  <div key={phone} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="font-mono text-sm text-slate-800">{phone}</span>
                    <span className="flex items-center gap-3">
                      <a href={'tel:' + phone} aria-label={'Call ' + phone} className="text-blue-700 hover:text-blue-900"><Phone className="h-4 w-4" /></a>
                      <a href={'https://wa.me/' + whatsappNumber} target="_blank" rel="noreferrer" aria-label={'WhatsApp ' + phone} className="text-green-700 hover:text-green-900"><MessageCircle className="h-4 w-4" /></a>
                    </span>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
        {filtered.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 sm:col-span-2 xl:col-span-3">No contacts match these filters.</div>}
      </div>
    </section>
  );
};
