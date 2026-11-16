(() => {
  const normalizeSlug = (value) => {
    const leaf = String(value || '').split('/').filter(Boolean).pop() || 'index.html';
    return leaf.includes('.') ? leaf.toLowerCase() : (leaf.toLowerCase() === 'home' ? 'index.html' : leaf.toLowerCase() + '.html');
  };

  const readBody = (raw) => {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed.content === 'string') return parsed.content;
      return typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? '');
    } catch {
      return String(raw || '');
    }
  };

  const makeSection = (item) => {
    const section = document.createElement('section');
    section.className = 'mx-auto my-8 max-w-7xl rounded-2xl border border-orange-100 bg-white px-5 py-7 shadow-sm sm:px-8';
    section.dataset.cmsSection = String(item.sectionKey || '');
    const heading = document.createElement('h2');
    heading.className = 'text-xl font-extrabold text-slate-900 sm:text-2xl';
    heading.textContent = String(item.title || '');
    section.appendChild(heading);

    const paragraph = document.createElement('p');
    paragraph.className = 'mt-3 whitespace-pre-line text-sm leading-7 text-slate-700 sm:text-base';
    paragraph.textContent = readBody(item.bodyJson);
    section.appendChild(paragraph);

    if (typeof item.mediaUrl === 'string' && /^https:\/\//i.test(item.mediaUrl)) {
      const image = document.createElement('img');
      image.src = item.mediaUrl;
      image.alt = String(item.title || 'Paw\'s Hopez Society update');
      image.loading = 'lazy';
      image.decoding = 'async';
      image.className = 'mt-5 max-h-[28rem] w-full rounded-xl object-cover';
      section.appendChild(image);
    }
    return section;
  };

  const insertSection = (root, section, key) => {
    const existing = Array.from(root.querySelectorAll(':scope > section[data-cms-section]'))
      .filter((node) => node.dataset.cmsSection === key);
    if (existing.length) {
      existing[existing.length - 1].after(section);
      return;
    }
    if (key === 'top_of_page') {
      root.prepend(section);
      return;
    }
    if (key === 'after_intro') {
      const first = root.querySelector(':scope > section:not([data-cms-section]), :scope > div');
      if (first) first.after(section);
      else root.appendChild(section);
      return;
    }
    if (key === 'before_bottom_section') {
      const last = Array.from(root.children).reverse().find((node) => !node.hasAttribute('data-cms-section'));
      if (last) last.before(section);
      else root.appendChild(section);
      return;
    }
    root.appendChild(section);
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
      const pageItems = items.filter((item) => normalizeSlug(item.pageSlug) === currentSlug);
      let titleApplied = false;
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
        insertSection(root, makeSection(item), String(item.sectionKey || 'bottom'));
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
