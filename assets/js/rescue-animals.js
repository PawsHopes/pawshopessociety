(() => {
  const grid = document.getElementById('rescue-animals-grid');
  const empty = document.getElementById('rescue-animals-empty');
  if (!grid || !empty) return;

  const make = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined && value !== null) element.textContent = String(value);
    return element;
  };

  const renderAnimal = (animal) => {
    const card = make('article', 'overflow-hidden rounded-3xl border border-slate-100 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-950');
    const images = Array.isArray(animal.images) ? animal.images : [];
    if (images.length && typeof images[0] === 'string' && /^(https:\/\/|\/)/i.test(images[0])) {
      const image = make('img', 'h-64 w-full object-cover');
      image.src = images[0];
      image.alt = animal.name ? String(animal.name) : 'Rescued animal';
      image.loading = 'lazy';
      image.decoding = 'async';
      card.appendChild(image);
    } else {
      card.appendChild(make('div', 'flex h-64 items-center justify-center bg-slate-100 text-5xl text-orange-500 dark:bg-slate-900', '🐾'));
    }

    const body = make('div', 'p-6');
    body.appendChild(make('span', 'inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase text-orange-700 dark:bg-orange-950 dark:text-orange-300', 'Rescue & Recovery'));
    body.appendChild(make('h3', 'mt-3 text-xl font-extrabold text-slate-900 dark:text-white', animal.name || 'Rescued animal'));
    const details = [animal.species, animal.breed, animal.age].filter(Boolean).join(' · ');
    if (details) body.appendChild(make('p', 'mt-1 text-sm font-medium text-slate-500 dark:text-slate-400', details));
    if (animal.description) body.appendChild(make('p', 'mt-4 whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-slate-300', animal.description));
    const careDetails = [animal.health, animal.healthConditions, animal.mobilityStatus && animal.mobilityStatus !== 'unknown' ? 'Mobility: ' + String(animal.mobilityStatus).replaceAll('_', ' ') : '', animal.specialCareNotes].filter(Boolean);
    if (careDetails.length) body.appendChild(make('p', 'mt-3 rounded-xl bg-orange-50 p-3 text-sm leading-6 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200', 'Care needs: ' + careDetails.join(' · ')));
    card.appendChild(body);
    return card;
  };

  fetch('/api/animals', { headers: { Accept: 'application/json' }, credentials: 'omit' })
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => {
      const rescued = payload && payload.success && Array.isArray(payload.data?.rescued) ? payload.data.rescued : [];
      grid.replaceChildren(...rescued.map(renderAnimal));
      empty.classList.toggle('hidden', rescued.length > 0);
      if (typeof window.AOS !== 'undefined') window.AOS.refreshHard();
    })
    .catch(() => {
      empty.classList.remove('hidden');
    });
})();
