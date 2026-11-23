const filters = {
  search: params.get('q') || '',
  status: params.get('status') || '',
  photos: params.has('photos'),
  sort: params.get('sort') || 'book',
  topics: new Set(params.getAll('topic')),
  limit: 24,
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
  app.innerHTML = `<header class="book-heading"><img src="assets/images/photographers-playbook.jpg" alt="The Photographer’s Playbook cover"><div><p class="eyebrow">Assignment library</p><h1>The Photographer’s Playbook</h1><p>Jason Fulford &amp; Gregory Halpern · 307 assignments</p></div></header>
    <details class="intro"><summary>About This Book</summary><div class="prose-body"><a class="text-link" href="${bookURL('playbook', intro.pdfPages[0], true)}">Open PDF ${intro.pdfPages[0]}</a>${intro.blocks.map((b) => `<p>${esc(b.text)}</p>`).join('')}<p>${esc(intro.plateNote)}</p><a class="text-link" href="${bookURL('playbook', intro.pdfPages[1], true)}">Plate note · PDF ${intro.pdfPages[1]}</a></div></details>
    <div class="filters"><label class="search">Search assignments<input id="query" type="search" placeholder="Title, contributor or text" value="${esc(filters.search)}"></label>
    <label>Status<select id="status"><option value="">All statuses</option>${Object.entries(
      statusLabels
    )
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join('')}</select></label>
    <label>Sort by<select id="sort"><option value="book">Book order</option><option value="author">Author A–Z</option></select></label>
    <label class="check"><input id="has-photos" type="checkbox"${filters.photos ? ' checked' : ''}> Has photos</label></div>
    <details class="topic-picker"><summary>Subject Guide <span id="topic-count"></span></summary><label class="sr" for="topic-search">Find a topic</label><input id="topic-search" type="search" placeholder="Find a topic"><div class="topic-options"></div></details>
    <div class="results-head"><span id="result-count" role="status"></span><div class="actions"><button id="clear" class="text-btn">Clear filters</button><button id="draw" class="btn primary">Draw one</button></div></div><div class="cards" id="results"></div><button id="more" class="btn">Show more</button>`;
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
    Q('#topic-count').textContent = filters.topics.size
      ? '(' + filters.topics.size + ' selected)'
      : '';
    Q('#draw').disabled = !results.some(
      (a) => assignmentState(p, a.id).status === 'todo'
    );
    Q('#clear').hidden =
      !term &&
      !filters.status &&
      !filters.photos &&
      !filters.topics.size &&
      filters.sort === 'book';
    Q('#more').hidden = filters.limit >= results.length;
    Q('#results').innerHTML =
      results
        .slice(0, filters.limit)
        .map((a) => {
          const words = flatText(a).split(/\s+/),
            n = photosFor(p, a.id).length;
          return `<a class="assignment-card" href="${assignmentURL(a.id)}"><div class="card-meta"><span class="eyebrow">No. ${String(a.seq).padStart(3, '0')}</span>${badge(assignmentState(p, a.id).status)}</div>
        <h2>${esc(a.title)}</h2><small>${esc(a.contributor)} · PDF ${range(a.pdfPages)}</small><p>${esc(words.slice(0, 30).join(' '))}${words.length > 30 ? '…' : ''}</p>
        <div class="card-foot"><span>${a.topics.slice(0, 3).map(esc).join(' · ')}</span><span>${n} photo${n === 1 ? '' : 's'}</span></div></a>`;
        })
        .join('') || '<p class="muted">No assignments match these filters.</p>';
    const url = new URL(location.href);
    url.search = '';
    if (filters.search) url.searchParams.set('q', filters.search);
    if (filters.status) url.searchParams.set('status', filters.status);
    if (filters.photos) url.searchParams.set('photos', '1');
    if (filters.sort !== 'book') url.searchParams.set('sort', filters.sort);
    for (const t of filters.topics) url.searchParams.append('topic', t);
    history.replaceState(null, '', url);
  }
  function changed() {
    filters.limit = 24;
    show();
  }
  Q('#status').value = filters.status;
  Q('#sort').value = filters.sort;
  Q('#query').oninput = (e) => {
    filters.search = e.target.value;
    changed();
  };
  Q('#status').onchange = (e) => {
    filters.status = e.target.value;
    changed();
  };
  Q('#sort').onchange = (e) => {
    filters.sort = e.target.value;
    changed();
  };
  Q('#has-photos').onchange = (e) => {
    filters.photos = e.target.checked;
    changed();
  };
  Q('#topic-search').oninput = topicOptions;
  Q('.topic-options').onchange = (e) => {
    const t = e.target.dataset.topic;
    if (e.target.checked) filters.topics.add(t);
    else filters.topics.delete(t);
    changed();
  };
  Q('#draw').onclick = () => draw(results, getProgress());
  Q('#clear').onclick = () => {
    Object.assign(filters, {
      search: '',
      status: '',
      sort: 'book',
      photos: false,
      topics: new Set(),
      limit: 24,
    });
    library();
  };
  Q('#more').onclick = () => {
    filters.limit += 24;
    show();
  };
  topicOptions();
  show();
}
startPage(library);
