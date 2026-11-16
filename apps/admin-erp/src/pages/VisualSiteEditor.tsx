import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Monitor, RefreshCw, Save } from 'lucide-react';
import { apiFetch } from '../lib/api';

type CmsItem = {
  id: string;
  page_slug: string;
  section_key: string;
  title: string;
  body_json: string;
  media_asset_id?: string | null;
  media_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  status: 'draft' | 'published' | 'archived';
  version_number: number;
  sort_order: number;
};

type Props = {
  canEdit: boolean;
  canPublish: boolean;
  onEditDraft: (row: Record<string, unknown>) => void;
  onRefresh: () => Promise<void>;
};

const PAGES = [
  ['index.html', 'Home'], ['about.html', 'About'], ['rescue.html', 'Rescue'],
  ['gallery.html', 'Gallery'], ['adopt.html', 'Adoption'], ['volunteer.html', 'Volunteer'],
  ['contact.html', 'Contact'], ['donate.html', 'Donate'],
] as const;
const SLOT_KEYS = ['top_of_page', 'after_intro', 'before_bottom_section', 'bottom_of_page'];
const SLOT_LABELS = ['Top of page', 'Below introduction', 'Before final section', 'Bottom of page'];

export const VisualSiteEditor: React.FC<Props> = ({ canEdit, canPublish, onEditDraft, onRefresh }) => {
  const [pageSlug, setPageSlug] = useState('index.html');
  const [items, setItems] = useState<CmsItem[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [previewKey, setPreviewKey] = useState(0);

  const publicPageUrl = useMemo(() => 'https://pawshopessociety.pages.dev/' + pageSlug, [pageSlug]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<{ items: CmsItem[] }>('/api/v1/admin/modules/website_content?limit=200');
    if (result.success && result.data) {
      const latest = new Map<string, CmsItem>();
      for (const row of result.data.items) {
        if (row.page_slug !== pageSlug || row.status === 'archived') continue;
        const key = row.section_key;
        if (!latest.has(key)) latest.set(key, row);
      }
      const ordered = [...latest.values()].sort((a, b) =>
        SLOT_KEYS.indexOf(a.section_key) - SLOT_KEYS.indexOf(b.section_key) ||
        Number(a.sort_order || 0) - Number(b.sort_order || 0)
      );
      setItems(ordered);
      setFeedback('');
    } else {
      setFeedback(result.error?.message || 'Could not load page content.');
    }
    setLoading(false);
  }, [pageSlug]);

  useEffect(() => { void load(); }, [load]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    setItems((current) => {
      const next = [...current];
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      return next;
    });
  };

  const saveDraftOrder = async () => {
    if (!canEdit || items.length === 0) return;
    if (items.length > SLOT_KEYS.length) {
      setFeedback('This page has more CMS sections than the four supported placement anchors. Split the page into fewer CMS sections before reordering.');
      return;
    }
    setSaving(true);
    setFeedback('');
    const created: CmsItem[] = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const sectionKey = SLOT_KEYS[index];
      const payload = {
        page_slug: pageSlug,
        section_key: sectionKey,
        title: item.title,
        body_json: item.body_json || JSON.stringify({ content: '' }),
        media_asset_id: item.media_asset_id || null,
        seo_title: item.seo_title || null,
        seo_description: item.seo_description || null,
        sort_order: index,
      };
      const result = await apiFetch<{ id: string }>('/api/v1/admin/modules/website_content', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!result.success || !result.data?.id) {
        setFeedback('Draft layout was only partially saved. ' + (result.error?.message || 'Retry after refreshing the page.'));
        setSaving(false);
        await load();
        return;
      }
      created.push({ ...item, id: result.data.id, section_key: sectionKey, status: 'draft', sort_order: index });
    }
    setItems(created);
    setFeedback('New draft layout saved. Review each draft and publish it from the CMS records list when ready.');
    await onRefresh();
    setSaving(false);
  };

  const publishDrafts = async () => {
    if (!canPublish) return;
    const drafts = items.filter((item) => item.status === 'draft');
    if (!drafts.length) {
      setFeedback('There are no unpublished layout drafts on this page.');
      return;
    }
    if (!window.confirm('Publish all draft CMS sections on this page? This updates the public website content feed.')) return;
    setSaving(true);
    setFeedback('');
    for (const item of drafts) {
      const result = await apiFetch('/api/v1/admin/modules/cms/' + encodeURIComponent(item.id) + '/publish', {
        method: 'POST',
        body: JSON.stringify({ published: true }),
      });
      if (!result.success) {
        setFeedback('Publishing stopped after a partial update: ' + (result.error?.message || 'A CMS section could not be published.'));
        setSaving(false);
        await load();
        await onRefresh();
        return;
      }
    }
    setFeedback('All draft CMS sections published. Refresh the public page to verify the result.');
    setSaving(false);
    await load();
    await onRefresh();
    setPreviewKey((value) => value + 1);
  };

  const draftPreview = items.map((item, index) => (
    <article key={item.id} className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-orange-700">{SLOT_LABELS[index] || 'CMS section'}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{item.status} · v{item.version_number}</span>
      </div>
      <h3 className="mt-2 text-lg font-bold text-slate-900">{item.title}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{(() => {
        try { const parsed = JSON.parse(item.body_json); return typeof parsed?.content === 'string' ? parsed.content : item.body_json; }
        catch { return item.body_json; }
      })()}</p>
      {item.media_url && <img src={item.media_url} alt={item.title} className="mt-3 max-h-48 w-full rounded-lg object-cover" />}
    </article>
  ));

  return (
    <section className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/60 p-4 sm:p-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-orange-800">Visual Website Editor</p>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">Preview, arrange and publish CMS sections</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Drag sections to change their placement on a page. Saving creates versioned drafts; publishing is a separate, confirmed action.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Choose website page" value={pageSlug} onChange={(event) => setPageSlug(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            {PAGES.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
          </select>
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Refresh</button>
        </div>
      </header>

      {feedback && <p role="status" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">{feedback}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">Page sections</h3><span className="text-xs text-slate-500">{items.length} active CMS section(s)</span></div>
          {loading ? <p className="rounded-xl bg-white p-6 text-sm text-slate-500">Loading CMS content…</p> : items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-orange-300 bg-white p-6 text-sm text-slate-600">No CMS sections on this page yet. Use the CMS form below to add the first section.</p>
          ) : items.map((item, index) => (
            <article key={item.id} draggable={canEdit} onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => {
              if (dragIndex !== null && dragIndex !== index) move(dragIndex, index);
              setDragIndex(null);
            }} onDragEnd={() => setDragIndex(null)} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <button type="button" aria-label="Drag to reorder section" className="cursor-grab rounded-lg bg-slate-100 p-2 text-slate-500"><GripVertical className="h-5 w-5" /></button>
              <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.section_key.replaceAll('_', ' ')} · {item.status}</p></div>
              <div className="flex gap-1">
                <button type="button" disabled={!canEdit || index === 0} onClick={() => move(index, index - 1)} aria-label="Move section up" className="rounded border border-slate-200 p-2 text-slate-600 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" disabled={!canEdit || index === items.length - 1} onClick={() => move(index, index + 1)} aria-label="Move section down" className="rounded border border-slate-200 p-2 text-slate-600 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                {item.status === 'draft' && canEdit && <button type="button" onClick={() => onEditDraft(item as unknown as Record<string, unknown>)} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">Edit</button>}
              </div>
            </article>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!canEdit || saving || items.length === 0} onClick={() => void saveDraftOrder()} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save draft layout'}</button>
            <button type="button" disabled={!canPublish || saving || !items.some((item) => item.status === 'draft')} onClick={() => void publishDrafts()} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Publish draft sections</button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2"><Monitor className="h-4 w-4 text-slate-600" /><h3 className="font-bold text-slate-900">Current public page preview</h3></div>
          <iframe key={previewKey} title={'Public page preview: ' + pageSlug} src={publicPageUrl} loading="lazy" className="h-[420px] w-full rounded-xl border border-slate-300 bg-white" />
          <p className="text-xs text-slate-500">This frame shows the current public website, not unpublished drafts. Draft content is previewed below; verify the staging domain before publishing if the public site is connected to a different database.</p>
          <div className="space-y-3">{draftPreview}</div>
        </div>
      </div>
    </section>
  );
};
