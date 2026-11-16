import React, { useEffect, useState } from 'react';
import { ImagePlus, Pencil, Archive, PawPrint, Eye } from 'lucide-react';
import { apiFetch } from '../lib/api';

type AnimalRow = Record<string, unknown>;
type Props = {
  rows: AnimalRow[];
  canEdit: boolean;
  canDelete: boolean;
  canPublish: boolean;
  onEdit: (row: AnimalRow) => void;
  onDelete: (row: AnimalRow) => void | Promise<void>;
  onPublish: (row: AnimalRow) => void | Promise<void>;
};

const label = (value: unknown, fallback = 'Not recorded') =>
  value === null || value === undefined || String(value).trim() === '' ? fallback : String(value);
const statusLabel = (value: unknown) => label(value, 'rescued').replaceAll('_', ' ');

export const AnimalVisualManager: React.FC<Props> = ({ rows, canEdit, canDelete, canPublish, onEdit, onDelete, onPublish }) => {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  useEffect(() => {
    let active = true;
    const loadPhotos = async () => {
      setLoadingPhotos(true);
      const entries = await Promise.all(rows.map(async (row) => {
        const id = String(row.id || '');
        if (!id) return [id, ''] as const;
        const result = await apiFetch<{ items: Record<string, unknown>[] }>(`/api/v1/admin/modules/attachments/animals/${encodeURIComponent(id)}`);
        const image = result.success && result.data
          ? result.data.items.find((item) => typeof item.public_url === 'string' && item.public_url.startsWith('https://'))
          : undefined;
        return [id, image ? String(image.public_url) : ''] as const;
      }));
      if (active) {
        setPhotos(Object.fromEntries(entries.filter(([id]) => id)));
        setLoadingPhotos(false);
      }
    };
    void loadPhotos();
    return () => { active = false; };
  }, [rows]);

  return (
    <section className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/60 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-orange-800"><Eye className="h-4 w-4" /><p className="text-xs font-bold uppercase tracking-wider">Visual adoption & animal page</p></div>
          <h2 className="mt-1 text-lg font-extrabold text-slate-900">Manage animals as website cards</h2>
          <p className="mt-1 text-sm text-slate-600">Select Edit to change the animal record, add photos and update its public description. Publishing remains a separate approval action.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="https://pawshopessociety.pages.dev/adopt.html" target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">View public adoption page</a>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{rows.length} records · {loadingPhotos ? 'Loading photos…' : 'Photo previews loaded'}</span>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-orange-300 bg-white p-8 text-center text-sm text-slate-500">
          <PawPrint className="mx-auto mb-2 h-7 w-7 text-orange-400" />No animal records on this page yet. Use Add Animal Registry above to create the first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const id = String(row.id || '');
            const photo = photos[id];
            const isPublished = Boolean(Number(row.is_published_public || 0));
            return (
              <article key={id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="relative h-48 bg-slate-100">
                  {photo ? <img src={photo} alt={label(row.name, 'Animal photo')} loading="lazy" className="h-full w-full object-cover" /> : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400"><ImagePlus className="h-9 w-9" /><span className="text-xs font-medium">No photo uploaded</span></div>
                  )}
                  <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold capitalize ${isPublished ? 'bg-green-100 text-green-800' : 'bg-slate-900/85 text-white'}`}>
                    {isPublished ? 'Published' : 'Draft / private'}
                  </span>
                  <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold capitalize text-slate-700">{statusLabel(row.current_status)}</span>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div><h3 className="text-lg font-extrabold text-slate-900">{label(row.name, 'Unnamed animal')}</h3><p className="mt-0.5 text-xs text-slate-500">{label(row.animal_code, 'No animal code')}</p></div>
                    <PawPrint className="mt-1 h-5 w-5 shrink-0 text-orange-500" />
                  </div>
                  <p className="text-sm text-slate-600">{[row.breed, row.species, row.gender, row.estimated_age_text].filter(Boolean).map(String).join(' · ') || 'Animal details not added yet.'}</p>
                  <p className="line-clamp-3 min-h-12 whitespace-pre-line text-sm leading-6 text-slate-600">{label(row.public_description, 'Add a public description so visitors can understand this animal’s story.')}</p>
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {canEdit && <button type="button" onClick={() => onEdit(row)} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700"><Pencil className="h-3.5 w-3.5" />Edit details & photos</button>}
                    {canPublish && <button type="button" onClick={() => void onPublish(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">{isPublished ? 'Unpublish' : 'Publish'}</button>}
                    {canDelete && <button type="button" onClick={() => void onDelete(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"><Archive className="h-3.5 w-3.5" />Archive</button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
