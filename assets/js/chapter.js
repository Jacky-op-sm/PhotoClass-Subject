const compactChapter = matchMedia('(max-width: 760px)');

document.addEventListener('keydown', (event) => {
  const toc = Q('#toc[open]');
  if (event.key === 'Escape' && toc) {
    toc.open = false;
    Q('summary', toc).focus();
  }
});
document.addEventListener('pointerdown', (event) => {
  const toc = Q('#toc[open]');
  if (compactChapter.matches && toc && !toc.contains(event.target)) toc.open = false;
});

function pageNote(page, continuing = false) {
  return `<a class="page-note${continuing ? ' continuing' : ''}" href="${bookURL('onbeing', page)}" aria-label="Open PDF page ${page}">p.&nbsp;${page}</a>`;
}

async function reader() {
  const [chapters, guide, assignments] = await bookData(
    'chapters',
    'guide',
    'assignments'
  );
  const chapter = chapters.find((c) => c.id === params.get('id'));
  if (!chapter) throw Error('Choose a chapter from On Being.');
  const { segments, tryNext } = guide[chapter.id];
  const marks = getProgress().onbeing.segments;
  const wasOpen = Q('#toc')?.open;
  const firstRender = wasOpen === undefined;
  document.title = 'PhotoClass: Subject — ' + chapter.title;
  const indices = new Map(chapter.blocks.map((b, i) => [b.id, i]));
  const reading = segments
    .map((segment) => {
      const blocks = chapter.blocks.slice(
        indices.get(segment.from),
        indices.get(segment.to) + 1
      );
      let page;
      const body = blocks
        .map((b) => {
          const start = b.page !== page ? pageNote(b.page) : '';
          const end =
            b.endPage && b.endPage !== b.page ? pageNote(b.endPage, true) : '';
          page = b.endPage || b.page;
          return `<div class="turn ${b.speaker || 'prose'}">${start}<p>${b.html}</p>${end}</div>`;
        })
        .join('');
      return `<section id="${segment.id}" class="segment" tabindex="-1"><h2>${esc(segment.title)}</h2>${body}
      <label class="mark"><input type="checkbox" data-segment="${segment.id}" ${marks[segment.id]?.read ? 'checked' : ''}>Mark as read</label></section>`;
    })
    .join('');
  const hasDialogue = chapter.blocks.some((b) => b.kind === 'turn');
  const part =
    chapter.type === 'reference'
      ? 'Reference'
      : 'Chapter ' + Number(chapter.id.slice(-2));
  const contents = segments
    .map(
      (s) =>
        `<a href="#${s.id}">${esc(s.title)}<span data-check="${s.id}" aria-label="${marks[s.id]?.read ? 'Read' : ''}">${marks[s.id]?.read ? ' ✓' : ''}</span></a>`
    )
    .join('');
  const suggestions = tryNext
    .map((rec) => {
      const a = assignments.find((entry) => entry.id === rec.assignment);
      return `<a class="recommend" href="${assignmentURL(a.id)}"><b>${esc(a.title)}</b><small>${esc(a.contributor)} · PDF&nbsp;${range(a.pdfPages)}</small><p>${esc(rec.why)}</p></a>`;
    })
    .join('');
  app.innerHTML = `<div class="reading-layout">
    <details id="toc"><summary aria-label="Chapter contents" title="Chapter contents"><span class="toc-icon" aria-hidden="true"></span><span class="toc-label">Contents</span></summary>
      <nav aria-label="Chapter segments">${contents}</nav></details>
    <div class="reader-column"><header class="reader-heading">
    <nav class="inline-meta" aria-label="Chapter location"><a href="onbeing.html">On Being</a> · ${part} · <a href="${bookURL('onbeing', chapter.printedPages[0])}">PDF&nbsp;${range(chapter.printedPages)}</a></nav>
    <h1>${esc(chapter.title)}</h1>${hasDialogue ? '<p class="speaker-key"><em>Italics for Bill Jay</em>, roman for David Hurn.</p>' : ''}</header>
    <article class="reader-text">${chapter.epigraph ? `<blockquote>${chapter.epigraph.lines.map(esc).join('<br>')}<cite>${esc(chapter.epigraph.attribution)}</cite></blockquote>` : ''}${reading}
    <section class="ruled">${sectionHead('Try next')}${suggestions}</section>
    ${chapter.id === 'ob-04' ? '<a class="text-link" href="subjects.html">Start your subject list</a>' : ''}</article></div></div>`;
  Q('#toc').open = wasOpen ?? false;
  for (const input of QA('[data-segment]'))
    input.onchange = () => {
      setSegmentRead(input.dataset.segment, input.checked);
      const check = Q(`[data-check="${input.dataset.segment}"]`);
      check.textContent = input.checked ? ' ✓' : '';
      check.setAttribute('aria-label', input.checked ? 'Read' : '');
    };
  Q('#toc nav').onclick = (e) => {
    if (compactChapter.matches && e.target.closest('a')) Q('#toc').open = false;
  };
  if (firstRender && location.hash)
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
startPage(reader);
