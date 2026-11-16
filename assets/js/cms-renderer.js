(() => {
  const safeImage = (value) => {
    try {
      const url = new URL(String(value || ''), window.location.origin);
      return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  };

  const readContent = (raw) => {
    try {
      const parsed = JSON.parse(String(raw || '{}'));
      return typeof parsed.content === 'string' ? parsed.content : '';
    } catch { return ''; }
  };

  const buildSection = (item) => {
    const section = document.createElement('section');
    section.dataset.cmsSection = String(item.sectionKey || '');
    section.className = 'cms-published-section mx-auto my-8 max-w-7xl rounded-2xl border border-orange-100 bg-white px-6 py-8 shadow-sm sm:px-10';
    const title = document.createElement('h2');
    title.className = 'text-2xl font-extrabold text-slate-900';
    title.textContent = String(item.title || '');
    section.appendChild(title);

    const content = readContent(item.bodyJson);
    if (content) {
      const paragraph = document.createElement('p');
      paragraph.className = 'mt-4 whitespace-pre-line text-base leading-7 text-slate-700';
      paragraph.textContent = content;
      section.appendChild(paragraph);
    }

    const imageUrl = safeImage(item.mediaUrl);
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = String(item.title || 'Paw\'s Hopez Society update');
      image.loading = 'lazy';
      image.className = 'mt-5 max-h-[28rem] w-full rounded-xl object-cover';
      section.appendChild(image);
    }
    return section;
  };

  const placeSection = (main, section, key) => {
    const children = Array.from(main.children).filter((node) => !node.hasAttribute('data-cms-section'));
    if (key === 'top_of_page') {
      main.insertBefore(section, main.firstChild);
      return;
    }
    if (key === 'after_intro') {
      const firstSection = children.find((node) => node.tagName === 'SECTION');
      if (firstSection?.parentNode) firstSection.insertAdjacentElement('afterend', section);
      else main.appendChild(section);
      return;
    }
    if (key === 'before_bottom_section') {
      const sections = children.filter((node) => node.tagName === 'SECTION');
      const lastSection = sections[sections.length - 1];
      if (lastSection?.parentNode) lastSection.insertAdjacentElement('beforebegin', section);
      else main.appendChild(section);
      return;
    }
    main.appendChild(section);
  };

  const run = async () => {
    const main = document.querySelector('main') || document.body;
    const pageSlug = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    try {
      const response = await fetch('/api/content', { headers: { Accept: 'application/json' }, credentials: 'omit' });
      if (!response.ok) return;
      const payload = await response.json();
      const items = payload?.success && Array.isArray(payload?.data?.items) ? payload.data.items : [];
      const published = items
        .filter((item) => item.pageSlug === pageSlug && item.sectionKey && item.title)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
      for (const item of published) {
        const key = String(item.sectionKey);
        if (!['top_of_page', 'after_intro', 'before_bottom_section', 'bottom_of_page'].includes(key)) continue;
        const old = main.querySelector('[data-cms-section="' + key + '"]');
        old?.remove();
        placeSection(main, buildSection(item), key);
      }
    } catch {
      // Static page content remains fully available if the CMS feed is offline.
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else void run();
})();
