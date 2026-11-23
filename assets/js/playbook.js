const filters = {
  search: params.get('q') || '',
  status: params.get('status') || '',
  photos: params.has('photos'),
  sort: params.get('sort') || 'book',
  topics: new Set(params.getAll('topic')),
};
async function library() {
  const [all, topics, intro] = await bookData('assignments', 'topics', 'intro'),
    p = getProgress();
  const pool = new Map(
    all.map((a) => [
      a.id,
      (a.title + ' ' + a.contributor + ' ' + flatText(a)).toLowerCase(),
    ])
  );
  const editingFilters =
    Q('#filter-toggle')?.getAttribute('aria-expanded') === 'true';
  app.innerHTML = `<header class="book-heading"><h1>The Photographer’s Playbook</h1><p>Jason Fulford &amp; Gregory Halpern</p></header>
    <details class="intro"><summary>About This Book</summary><div class="prose-body"><a class="text-link" href="${bookURL('playbook', intro.pdfPages[0], true)}">Open PDF ${intro.pdfPages[0]}</a>${intro.blocks.map((b) => `<p>${esc(b.text)}</p>`).join('')}<p>${esc(intro.plateNote)}</p><a class="text-link" href="${bookURL('playbook', intro.pdfPages[1], true)}">Plate note · PDF ${intro.pdfPages[1]}</a></div></details>
    <div class="library-tools"><label class="sr" for="query">Search assignments by title, contributor or text</label><input id="query" type="search" placeholder="Search assignments" value="${esc(filters.search)}">
    <button class="text-btn" type="button" id="filter-toggle" aria-controls="library-filters" aria-expanded="${editingFilters}">Filters</button><button id="draw" class="btn">Draw one</button></div>
    <section id="library-filters" aria-label="Assignment filters" ${editingFilters ? '' : 'hidden'}><div class="filters">
    <label>Status<select id="status"><option value="">All statuses</option>${Object.entries(
      statusLabels
    )
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join('')}</select></label>
    <label>Sort by<select id="sort"><option value="book">Book order</option><option value="author">Author A–Z</option></select></label>
    <label class="check"><input id="has-photos" type="checkbox"${filters.photos ? ' checked' : ''}> Has photos</label></div>
    <label for="topic-search">Subject Guide</label><input id="topic-search" type="search" placeholder="Find a topic"><div class="topic-options"></div></section>
    <div class="results-head"><span id="result-count" role="status"></span><span id="active-filters"></span><button id="clear" class="text-btn">Clear filters</button></div><ul role="list" class="assignment-list" id="results"></ul>`;
  let results = [];
  function topicOptions() {
    const term = Q('#topic-search').value.toLowerCase();
    Q('.topic-options').innerHTML =
      Object.keys(topics)
        .filter((t) => t.toLowerCase().includes(term))
        .map(
          (t) =>
            `<label class="check"><input type="checkbox" data-topic="${esc(t)}" ${filters.topics.has(t) ? 'checked' : ''}>${esc(t)}</label>`
        )
        .join('') || '<p>No matching topics.</p>';
  }
  function show() {
    const term = filters.search.trim().toLowerCase();
    results = all.filter(
      (a) =>
        (!term || pool.get(a.id).includes(term)) &&
        (!filters.status ||
          assignmentState(p, a.id).status === filters.status) &&
        (!filters.photos || photosFor(p, a.id).length) &&
        [...filters.topics].every((t) => topics[t]?.assignments.includes(a.id))
    );
    if (filters.sort === 'author')
      results.sort(
        (a, b) =>
          a.contributor.localeCompare(b.contributor, 'en') || a.seq - b.seq
      );
    Q('#result-count').textContent =
      results.length + ' assignment' + (results.length === 1 ? '' : 's');
    const active = [...filters.topics];
    if (filters.status) active.push(statusLabels[filters.status]);
    if (filters.photos) active.push('Has photos');
    if (filters.sort === 'author') active.push('Author A–Z');
    Q('#active-filters').textContent = active.join(' · ');
    Q('#draw').disabled = !results.some(
      (a) => assignmentState(p, a.id).status === 'todo'
    );
    Q('#clear').hidden =
      !term &&
      !filters.status &&
      !filters.photos &&
      !filters.topics.size &&
      filters.sort === 'book';
    Q('#results').innerHTML =
      results
        .map((a) => {
          const words = flatText(a, ' · ').trim().split(/\s+/);
          const summary =
            words.slice(0, 30).join(' ').replace(/ ·$/, '') +
            (words.length > 30 ? '…' : '');
          const status = assignmentState(p, a.id).status;
          const count = photosFor(p, a.id).length;
          const notes = [];
          if (status === 'current' || status === 'done')
            notes.push(statusLabels[status]);
          if (count) notes.push(count + (count === 1 ? ' photo' : ' photos'));
          return `<li><a class="assignment-row" href="${assignmentURL(a.id)}"><div class="row-title"><h2>${esc(a.title)}</h2>${notes.length ? `<small>${notes.join(' · ')}</small>` : ''}</div>
            <span class="row-author">${esc(a.contributor)}</span><span class="page-ref">PDF&nbsp;${range(a.pdfPages)}</span><p class="row-summary">${esc(summary)}</p></a></li>`;
        })
        .join('') ||
      '<li class="muted">No assignments match these filters.</li>';
    const url = new URL(location.href);
    url.search = '';
    if (filters.search) url.searchParams.set('q', filters.search);
    if (filters.status) url.searchParams.set('status', filters.status);
    if (filters.photos) url.searchParams.set('photos', '1');
    if (filters.sort !== 'book') url.searchParams.set('sort', filters.sort);
    for (const t of filters.topics) url.searchParams.append('topic', t);
    history.replaceState(null, '', url);
  }
  Q('#filter-toggle').onclick = (event) => {
    const panel = Q('#library-filters');
    panel.hidden = !panel.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
  };
  Q('#status').value = filters.status;
  Q('#sort').value = filters.sort;
  Q('#query').oninput = (e) => {
    filters.search = e.target.value;
    show();
  };
  Q('#status').onchange = (e) => {
    filters.status = e.target.value;
    show();
  };
  Q('#sort').onchange = (e) => {
    filters.sort = e.target.value;
    show();
  };
  Q('#has-photos').onchange = (e) => {
    filters.photos = e.target.checked;
    show();
  };
  Q('#topic-search').oninput = topicOptions;
  Q('.topic-options').onchange = (e) => {
    const t = e.target.dataset.topic;
    if (e.target.checked) filters.topics.add(t);
    else filters.topics.delete(t);
    show();
  };
  Q('#draw').onclick = () => draw(results, getProgress());
  Q('#clear').onclick = () => {
    Object.assign(filters, {
      search: '',
      status: '',
      sort: 'book',
      photos: false,
      topics: new Set(),
    });
    library();
  };
  topicOptions();
  show();
}
startPage(library);
