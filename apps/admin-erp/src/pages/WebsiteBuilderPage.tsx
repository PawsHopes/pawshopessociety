import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, type AuthUser } from '../lib/api';

type BlockType = 'content' | 'hero' | 'text' | 'image' | 'cta';
type SectionKey = 'top_of_page' | 'after_intro' | 'before_bottom_section' | 'bottom_of_page';

type ContentRow = {
  id: string;
  page_slug: string;
  section_key: SectionKey;
  title: string;
  body_json: string;
  block_type?: BlockType;
  sort_order?: number;
  status: 'draft' | 'published' | 'archived';
  version_number?: number;
  media_asset_id?: string | null;
  mediaUrl?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
};

type EditorForm = {
  pageSlug: string;
  sectionKey: SectionKey;
  blockType: BlockType;
  title: string;
  content: string;
  buttonLabel: string;
  buttonUrl: string;
  imageAlt: string;
  seoTitle: string;
  seoDescription: string;
};

const PAGES = [
  ['index.html', 'Home page'],
  ['about.html', 'About us'],
  ['rescue.html', 'Animal rescue'],
  ['gallery.html', 'Rescue gallery'],
  ['adopt.html', 'Adoption'],
  ['volunteer.html', 'Volunteer'],
  ['contact.html', 'Contact'],
  ['donate.html', 'Donate'],
] as const;

const SLOTS: Array<[SectionKey, string]> = [
  ['top_of_page', 'At the top of the page'],
  ['after_intro', 'Below the introduction'],
  ['before_bottom_section', 'Before the final section'],
  ['bottom_of_page', 'At the bottom of the page'],
];

const emptyForm = (pageSlug: string): EditorForm => ({
  pageSlug,
  sectionKey: pageSlug === 'index.html' ? 'top_of_page' : 'after_intro',
  blockType: pageSlug === 'index.html' ? 'hero' : 'content',
  title: '',
  content: '',
  buttonLabel: '',
  buttonUrl: '',
  imageAlt: '',
  seoTitle: '',
  seoDescription: '',
});

const parseBody = (value: string) => {
  try {
    const parsed = JSON.parse(value || '{}');
    return {
      content: String(parsed?.content || ''),
      buttonLabel: String(parsed?.buttonLabel || ''),
      buttonUrl: String(parsed?.buttonUrl || ''),
      imageAlt: String(parsed?.imageAlt || ''),
    };
  } catch {
    return { content: String(value || ''), buttonLabel: '', buttonUrl: '', imageAlt: '' };
  }
};

interface Props { user: AuthUser }

export const WebsiteBuilderPage: React.FC<Props> = ({ user }) => {
  const canWrite = user.permissions.includes('cms:write');
  const canPublish = user.permissions.includes('cms:publish');
  const [pageSlug, setPageSlug] = useState<string>('index.html');
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [form, setForm] = useState<EditorForm>(emptyForm('index.html'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [selectedImagePreview, setSelectedImagePreview] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  const pageRows = useMemo(
    () => rows.filter((row) => row.page_slug === pageSlug && row.status !== 'archived').sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    [rows, pageSlug],
  );

  const previewRows = useMemo<ContentRow[]>(() => {
    const draftRow: ContentRow = {
      id: editingId || '__preview__',
      page_slug: form.pageSlug,
      section_key: form.sectionKey,
      title: form.title || 'Your heading will appear here',
      body_json: JSON.stringify({
        content: form.content,
        buttonLabel: form.buttonLabel,
        buttonUrl: form.buttonUrl,
        imageAlt: form.imageAlt,
      }),
      block_type: form.blockType,
      sort_order: editingId
        ? Number(pageRows.find((row) => row.id === editingId)?.sort_order || 0)
        : pageRows.reduce((max, row) => Math.max(max, Number(row.sort_order || 0)), -10) + 10,
      status: 'draft',
    };
    const next = [...pageRows];
    const existingIndex = editingId ? next.findIndex((row) => row.id === editingId) : -1;
    if (existingIndex >= 0) next[existingIndex] = draftRow;
    else next.push(draftRow);
    return next.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  }, [pageRows, editingId, form]);

  const load = async () => {
    const result = await apiFetch<{ items: ContentRow[] }>('/api/v1/admin/modules/website_content?limit=200');
    if (!result.success || !result.data) {
      setFeedback(result.error?.message || 'Unable to load website content.');
      return;
    }
    setRows(result.data.items || []);
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!selectedImage) { setSelectedImagePreview(existingImageUrl); return; }
    const objectUrl = URL.createObjectURL(selectedImage);
    setSelectedImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage, existingImageUrl]);

  const resetEditor = () => {
    setEditingId(null);
    setForm(emptyForm(pageSlug));
    setSelectedImage(null);
    setExistingImageUrl('');
    setSelectedImagePreview('');
    setPreviewMode(false);
  };

  const editRow = async (row: ContentRow) => {
    setBusy(true);
    setFeedback('');
    let target = row;
    if (row.status === 'published') {
      const draft = await apiFetch<{ id: string; version: number }>(`/api/v1/admin/modules/cms/${row.id}/draft`, { method: 'POST' });
      if (!draft.success || !draft.data) {
        setFeedback(draft.error?.message || 'Could not create a safe draft of the published section.');
        setBusy(false);
        return;
      }
      target = { ...row, id: draft.data.id, status: 'draft', version_number: draft.data.version };
      await load();
    }
    const body = parseBody(target.body_json);
    setEditingId(target.id);
    setForm({
      pageSlug: target.page_slug,
      sectionKey: target.section_key,
      blockType: target.block_type || 'content',
      title: target.title || '',
      content: body.content,
      buttonLabel: body.buttonLabel,
      buttonUrl: body.buttonUrl,
      imageAlt: body.imageAlt,
      seoTitle: target.seo_title || '',
      seoDescription: target.seo_description || '',
    });
    const media = await apiFetch<{ items: Array<{ public_url?: string | null }> }>(`/api/v1/admin/modules/attachments/website_content/${target.id}`);
    setExistingImageUrl(media.success && media.data ? String(media.data.items.find((item) => item.public_url)?.public_url || '') : '');
    setSelectedImage(null);
    setPreviewMode(false);
    setBusy(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setFeedback('');
    const currentOrder = pageRows.reduce((max, row) => Math.max(max, Number(row.sort_order || 0)), -10) + 10;
    const payload = {
      page_slug: form.pageSlug,
      section_key: form.sectionKey,
      title: form.title.trim(),
      body_json: JSON.stringify({
        content: form.content,
        buttonLabel: form.buttonLabel,
        buttonUrl: form.buttonUrl,
        imageAlt: form.imageAlt,
      }),
      block_type: form.blockType,
      sort_order: editingId ? Number(pageRows.find((row) => row.id === editingId)?.sort_order || currentOrder) : currentOrder,
      seo_title: form.seoTitle,
      seo_description: form.seoDescription,
    };
    const result = editingId
      ? await apiFetch<ContentRow>(`/api/v1/admin/modules/website_content/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : await apiFetch<ContentRow>('/api/v1/admin/modules/website_content', { method: 'POST', body: JSON.stringify(payload) });

    if (!result.success || !result.data) {
      setFeedback(result.error?.message || 'Could not save this section.');
      setBusy(false);
      return;
    }

    const savedId = editingId || result.data.id;
    if (selectedImage && savedId) {
      const upload = new FormData();
      upload.append('file', selectedImage);
      upload.append('altText', form.imageAlt || form.title);
      const uploaded = await apiFetch<{ id: string }>('/api/v1/admin/uploads/public-media', { method: 'POST', body: upload });
      if (!uploaded.success || !uploaded.data) {
        setFeedback(uploaded.error?.message || 'Section saved, but its image upload failed. Retry with the image selected.');
        setBusy(false);
        await load();
        return;
      }
      const linked = await apiFetch<{ id: string }>(`/api/v1/admin/modules/attachments/website_content/${savedId}`, {
        method: 'POST',
        body: JSON.stringify({ mediaAssetId: uploaded.data.id, label: form.imageAlt || form.title }),
      });
      if (!linked.success) {
        setFeedback(linked.error?.message || 'Section saved, but the image could not be linked.');
        setBusy(false);
        await load();
        return;
      }
    }

    setFeedback(editingId ? 'Draft saved. Publish it when the preview is correct.' : 'New section saved as a draft.');
    setBusy(false);
    setSelectedImage(null);
    await load();
  };

  const publish = async (row: ContentRow) => {
    if (!canPublish) return;
    const isPublished = row.status === 'published';
    const prompt = isPublished ? 'Unpublish this section from the public website?' : 'Publish this section to the public website now?';
    if (!window.confirm(prompt)) return;
    setBusy(true);
    const result = await apiFetch(`/api/v1/admin/modules/cms/${row.id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ published: !isPublished }),
    });
    setFeedback(result.success ? (isPublished ? 'Section unpublished.' : 'Section published on the live website.') : result.error?.message || 'Publishing failed.');
    await load();
    setBusy(false);
  };

  const reorder = async (sourceId: string, targetId: string) => {
    if (!canPublish || sourceId === targetId) return;
    const next = [...pageRows];
    const from = next.findIndex((row) => row.id === sourceId);
    const to = next.findIndex((row) => row.id === targetId);
    if (from < 0 || to < 0) return;
    const targetSectionKey = next[to].section_key;
    const [moved] = next.splice(from, 1);
    moved.section_key = targetSectionKey;
    next.splice(to, 0, moved);
    setRows((all) => [...all.filter((row) => row.page_slug !== pageSlug), ...next.map((row, index) => ({ ...row, sort_order: index * 10 }))]);
    setBusy(true);
    const result = await apiFetch('/api/v1/admin/modules/cms/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ pageSlug, items: next.map((row, index) => ({ id: row.id, sortOrder: index * 10, sectionKey: row.section_key })) }),
    });
    if (!result.success) {
      setFeedback(result.error?.message || 'Could not save the new section order.');
      await load();
    } else setFeedback('Page section order saved.');
    setBusy(false);
  };

  const beginNew = () => {
    resetEditor();
    setForm(emptyForm(pageSlug));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const previewImage = selectedImagePreview;

  if (!user.permissions.includes('cms:read')) {
    return <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6"><h1 className="font-semibold">Access denied</h1><p className="mt-2 text-sm">CMS read permission is required.</p></section>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Paw's Hopez Society</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Visual Website Builder</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Edit page sections, add images and calls to action, drag sections into a new order, preview drafts, and publish only when ready.</p>
        </div>
        <button type="button" onClick={beginNew} disabled={!canWrite} className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">+ Add section</button>
      </header>

      {feedback && <div role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{feedback}</div>}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block text-xs font-bold text-slate-600">Website page</span>
          <select value={pageSlug} onChange={(event) => { const nextPage = event.target.value; setPageSlug(nextPage); setEditingId(null); setSelectedImage(null); setExistingImageUrl(''); setForm(emptyForm(nextPage)); setPreviewMode(false); }} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            {PAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <a href={pageSlug === 'index.html' ? 'https://pawshopessociety.pages.dev/' : `https://pawshopessociety.pages.dev/${pageSlug}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Open live page ↗</a>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Refresh</button>
      </div>

      {pageSlug === 'adopt.html' && user.permissions.includes('animals:read') && <section className="flex flex-col gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-bold text-slate-900">Adoption animal profiles</p><p className="mt-1 text-sm text-slate-600">Dog and animal cards are linked to the central Animal Registry. Manage profiles, photos, adoption eligibility and publishing without creating duplicate CMS records.</p></div>
        <a href="/modules/animals" className="shrink-0 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700">Open visual animal manager</a>
      </section>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h2 className="font-bold text-slate-900">Page sections</h2><p className="text-xs text-slate-500">Drag the handle to change their order.</p></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{pageRows.length} blocks</span>
          </div>
          <div className="space-y-2">
            {pageRows.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No CMS sections yet. Add a Hero block to start editing the homepage.</p>}
            {pageRows.map((row) => (
              <article key={row.id} draggable={canPublish && !busy} onDragStart={() => setDragId(row.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragId) void reorder(dragId, row.id); setDragId(null); }} onDragEnd={() => setDragId(null)}
                className={`flex items-center gap-3 rounded-xl border p-3 ${dragId === row.id ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white'}`}>
                <button type="button" aria-label="Drag to reorder" disabled={!canPublish || busy} className="cursor-grab rounded-lg bg-slate-100 px-2 py-2 text-slate-500 disabled:cursor-not-allowed">⠿</button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold text-slate-900">{row.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${row.status === 'published' ? 'bg-green-100 text-green-700' : row.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{row.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{row.block_type || 'content'} · {SLOTS.find(([key]) => key === row.section_key)?.[1] || row.section_key} · v{row.version_number || 1}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {row.status !== 'archived' && <button type="button" onClick={() => void editRow(row)} disabled={!canWrite || busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50">Edit</button>}
                  {row.status !== 'archived' && <button type="button" onClick={() => void publish(row)} disabled={!canPublish || busy} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{row.status === 'published' ? 'Unpublish' : 'Publish'}</button>}
                </div>
              </article>
            ))}
          </div>
          {!canPublish && <p className="mt-3 text-xs text-amber-700">Your role can edit drafts but cannot publish or reorder live page sections.</p>}
        </section>

        <section className="space-y-4">
          <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h2 className="font-bold text-slate-900">{editingId ? 'Edit section draft' : 'Create page section'}</h2><p className="text-xs text-slate-500">Changes stay in draft until published.</p></div>
              <button type="button" onClick={() => setPreviewMode(!previewMode)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">{previewMode ? 'Hide page preview' : 'Preview page'}</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">Section type</span><select value={form.blockType} onChange={(event) => setForm((v) => ({ ...v, blockType: event.target.value as BlockType }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="hero">Hero banner</option><option value="text">Text section</option><option value="image">Image + text</option><option value="cta">Call to action</option><option value="content">Simple content</option></select></label>
              <label><span className="mb-1 block text-xs font-bold text-slate-600">Place section</span><select value={form.sectionKey} onChange={(event) => setForm((v) => ({ ...v, sectionKey: event.target.value as SectionKey }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{SLOTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span className="mb-1 block text-xs font-bold text-slate-600">Heading</span><input required maxLength={180} value={form.title} onChange={(event) => setForm((v) => ({ ...v, title: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">Text / description</span><textarea rows={4} maxLength={6000} value={form.content} onChange={(event) => setForm((v) => ({ ...v, content: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              {['hero','cta'].includes(form.blockType) && <>
                <label><span className="mb-1 block text-xs font-bold text-slate-600">Button label</span><input maxLength={80} value={form.buttonLabel} onChange={(event) => setForm((v) => ({ ...v, buttonLabel: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
                <label><span className="mb-1 block text-xs font-bold text-slate-600">Button URL (https or /path)</span><input maxLength={500} value={form.buttonUrl} onChange={(event) => setForm((v) => ({ ...v, buttonUrl: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              </>}
              {['hero','image','content'].includes(form.blockType) && <label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">Image (optional)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setSelectedImage(event.target.files?.[0] || null)} className="w-full text-sm" /><span className="mt-1 block text-xs text-slate-500">Images upload to the Society's public R2 media bucket.</span></label>}
              <label><span className="mb-1 block text-xs font-bold text-slate-600">SEO title</span><input maxLength={180} value={form.seoTitle} onChange={(event) => setForm((v) => ({ ...v, seoTitle: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              <label><span className="mb-1 block text-xs font-bold text-slate-600">SEO description</span><input maxLength={320} value={form.seoDescription} onChange={(event) => setForm((v) => ({ ...v, seoDescription: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="submit" disabled={!canWrite || busy} className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save draft'}</button>
              <button type="button" onClick={resetEditor} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Clear</button>
            </div>
          </form>

          {previewMode && <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-600">Page preview</p><h3 className="font-bold text-slate-900">{PAGES.find(([value]) => value === form.pageSlug)?.[1]}</h3></div>
              <span className="text-xs text-slate-500">{previewRows.length} sections</span>
            </div>
            {previewRows.map((row) => {
              const body = parseBody(row.body_json);
              const type = row.block_type || 'content';
              const current = row.id === (editingId || '__preview__');
              const surface = type === 'hero' ? 'bg-slate-900 text-white border-slate-800' : type === 'cta' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-900 border-slate-200';
              return <article key={row.id} className={`rounded-xl border p-4 shadow-sm ${surface}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{type} · {row.section_key.replaceAll('_', ' ')}</span>
                  {row.id !== '__preview__' && <button type="button" onClick={() => { const actual = pageRows.find((item) => item.id === row.id); if (actual) void editRow(actual); }} disabled={!canWrite || busy} className="rounded-md border border-current/30 px-2 py-1 text-[10px] font-bold disabled:opacity-50">Edit</button>}
                  {current && <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">Current draft</span>}
                </div>
                <h4 className="text-lg font-extrabold">{row.title}</h4>
                {body.content && <p className="mt-2 whitespace-pre-line text-sm leading-6 opacity-85">{body.content}</p>}
                {current && previewImage && <img src={previewImage} alt={form.imageAlt || form.title} className="mt-3 max-h-48 w-full rounded-lg object-cover" />}
                {row.media_asset_id && !current && <p className="mt-2 text-xs opacity-60">R2 image attached</p>}
                {body.buttonLabel && <span className="mt-3 inline-block rounded-full bg-white/90 px-4 py-2 text-xs font-bold text-orange-700">{body.buttonLabel}</span>}
              </article>;
            })}
          </div>}
        </section>
      </div>
    </div>
  );
};
