(() => {
  const normalizeSlug = (value) => {
    const leaf = String(value || '').split('/').filter(Boolean).pop() || 'index.html';
    return leaf.includes('.') ? leaf.toLowerCase() : (leaf.toLowerCase() === 'home' ? 'index.html' : leaf.toLowerCase() + '.html');
  };

  const parseBody = (raw) => {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed === 'object') return parsed;
      return { content: typeof parsed === 'string' ? parsed : '' };
    } catch {
      return { content: String(raw || '') };
    }
  };

  const safeUrl = (value) => {
    const url = String(value || '').trim();
    return /^https:\/\//i.test(url) || /^\/(?!\/)/.test(url) ? url : '';
  };

  const makeSection = (item) => {
    const body = parseBody(item.bodyJson);
    const type = String(item.blockType || body.type || 'content');
    const section = document.createElement('section');
    section.className = 'mx-auto my-8 max-w-7xl rounded-2xl border border-orange-100 bg-white px-5 py-7 shadow-sm sm:px-8';
    section.dataset.cmsSection = String(item.sectionKey || '');
    section.dataset.cmsBlockType = type;

    const heading = document.createElement(type === 'hero' ? 'h1' : 'h2');
    heading.className = type === 'hero'
      ? 'text-3xl font-extrabold text-white sm:text-5xl'
      : 'text-xl font-extrabold text-slate-900 sm:text-2xl';
    heading.textContent = String(item.title || '');
    section.appendChild(heading);

    const content = String(body.content || '');
    if (content) {
      const paragraph = document.createElement('p');
      paragraph.className = type === 'hero'
        ? 'mt-4 max-w-3xl whitespace-pre-line text-base leading-8 text-orange-50 sm:text-lg'
        : 'mt-3 whitespace-pre-line text-sm leading-7 text-slate-700 sm:text-base';
      paragraph.textContent = content;
      section.appendChild(paragraph);
    }

    const mediaUrl = safeUrl(item.mediaUrl || body.imageUrl);
    if (mediaUrl && ['hero', 'image', 'content'].includes(type)) {
      const image = document.createElement('img');
      image.src = mediaUrl;
      image.alt = String(body.imageAlt || item.title || "Paw's Hopez Society update");
      image.loading = 'lazy';
      image.decoding = 'async';
      image.className = type === 'hero'
        ? 'mt-6 max-h-[30rem] w-full rounded-xl object-cover'
        : 'mt-5 max-h-[28rem] w-full rounded-xl object-cover';
      section.appendChild(image);
    }

    const buttonLabel = String(body.buttonLabel || '').trim();
    const buttonUrl = safeUrl(body.buttonUrl);
    if (buttonLabel && buttonUrl && ['hero', 'cta'].includes(type)) {
      const link = document.createElement('a');
      link.href = buttonUrl;
      link.textContent = buttonLabel;
      link.className = 'mt-6 inline-flex items-center rounded-full bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow hover:bg-orange-700';
      section.appendChild(link);
    }

    if (type === 'hero') {
      section.className = 'mx-auto my-8 max-w-7xl overflow-hidden rounded-3xl bg-slate-900 px-6 py-12 shadow-lg sm:px-10 sm:py-16';
    } else if (type === 'cta') {
      section.className = 'mx-auto my-8 max-w-7xl rounded-3xl bg-orange-600 px-6 py-10 text-white shadow-lg sm:px-10';
      heading.className = 'text-2xl font-extrabold text-white sm:text-3xl';
      const paragraph = section.querySelector('p');
      if (paragraph) paragraph.className = 'mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-orange-50 sm:text-base';
    }
    return section;
  };

  const insertSection = (root, section, key, anchors) => {
    const previous = anchors[key];
    if (previous && previous.parentElement === root) {
      previous.after(section);
    } else if (key === 'top_of_page') {
      root.prepend(section);
    } else if (key === 'after_intro') {
      const first = root.firstElementChild;
      if (first) first.after(section);
      else root.appendChild(section);
    } else if (key === 'before_bottom_section') {
      const last = root.lastElementChild;
      if (last) last.before(section);
      else root.appendChild(section);
    } else {
      root.appendChild(section);
    }
    anchors[key] = section;
  };

  const load = async () => {
    const root = document.querySelector('main#main-content, main, #main-content');
    if (!root) return;
    try {
      const response = await fetch('/api/content', { headers: { Accept: 'application/json' }, credentials: 'omit' });
      if (!response.ok) return;
      const payload = await response.json();
      const items = payload?.success && Array.isArray(payload?.data?.items) ? payload.data.items : [];
      const currentSlug = normalizeSlug(window.location.pathname);
      const pageItems = items
        .filter((item) => normalizeSlug(item.pageSlug) === currentSlug)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

      const hero = pageItems.find((item) => String(item.blockType || '') === 'hero' && String(item.sectionKey || '') === 'top_of_page');
      if (hero && currentSlug === 'index.html') {
        const originalHero = root.querySelector(':scope > section:not([data-cms-section]), :scope > div:not([data-cms-section])');
        if (originalHero) {
          originalHero.hidden = true;
          originalHero.dataset.cmsOriginalHero = 'true';
        }
      }

      let titleApplied = false;
      const anchors = {};
      for (const item of pageItems) {
        if (item.seoTitle && !titleApplied) {
          document.title = String(item.seoTitle);
          titleApplied = true;
        }
        if (item.seoDescription) {
          let meta = document.querySelector('meta[name="description"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'description';
            document.head.appendChild(meta);
          }
          meta.content = String(item.seoDescription);
        }
        insertSection(root, makeSection(item), String(item.sectionKey || 'bottom_of_page'), anchors);
      }
    } catch {
      // The static website remains fully usable if the CMS feed is unavailable.
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else {
    void load();
  }
})();
