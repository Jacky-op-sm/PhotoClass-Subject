let sidebarHidden = false;
async function reader() {
  const [chapters, guide, assignments] = await bookData(
    'chapters',
    'guide',
    'assignments'
  );
  const c = chapters.find((c) => c.id === params.get('id'));
  if (!c) throw Error('Choose a chapter from On Being.');
  const p = getProgress(),
    { segments, tryNext } = guide[c.id];
  document.title = 'PhotoClass: Subject — ' + c.title;
  const blockIndex = new Map(c.blocks.map((b, i) => [b.id, i]));
  const reading = segments
    .map((s) => {
      const blocks = c.blocks.slice(
        blockIndex.get(s.from),
        blockIndex.get(s.to) + 1
      );
      let lastPage = null,
        lastSpeaker = null;
      return `<section id="${esc(s.id)}" class="segment"><h2>${esc(s.title)}</h2>${blocks
        .map((b) => {
          const marker =
            b.page !== lastPage
              ? `<a class="page-marker" href="${bookURL('onbeing', b.page)}">p. ${b.page}</a>`
              : '';
          const label =
            b.speaker && b.speaker !== lastSpeaker
              ? `<span class="speaker">${b.speaker === 'bill' ? 'Bill Jay' : 'David Hurn'}</span>`
              : '';
          lastPage = b.endPage || b.page;
          lastSpeaker = b.speaker;
          return `<div class="turn ${b.speaker || 'prose'}">${marker}${label}<p>${b.html}</p>${b.endPage && b.endPage !== b.page ? `<a class="end-page" href="${bookURL('onbeing', b.endPage)}">continues on p. ${b.endPage}</a>` : ''}</div>`;
        })
        .join(
          ''
        )}<label class="mark"><input type="checkbox" data-segment="${esc(s.id)}" ${p.onbeing.segments[s.id]?.read ? 'checked' : ''}> Mark as read</label></section>`;
    })
    .join('');
  app.innerHTML = `<a class="crumb" href="onbeing.html">On Being</a><header class="heading"><div><p class="eyebrow">${c.type === 'reference' ? 'Reference' : 'Chapter ' + Number(c.id.slice(-2))} · pp. ${range(c.printedPages)}</p><h1>${esc(c.title)}</h1></div><a class="btn" href="${bookURL('onbeing', c.printedPages[0])}">Open PDF p. ${c.printedPages[0]}</a></header>
    <button id="toggle-sidebar" class="btn" aria-expanded="${!sidebarHidden}" aria-controls="toc">${sidebarHidden ? 'Show' : 'Hide'} segments</button>
    <div class="reading-layout ${sidebarHidden ? 'wide' : ''}"><aside id="toc" ${sidebarHidden ? 'hidden' : ''}><p class="eyebrow">In this chapter</p>${segments.map((s) => `<a href="#${s.id}"><span data-check="${s.id}">${p.onbeing.segments[s.id]?.read ? '✓' : '○'}</span> ${esc(s.title)}</a>`).join('')}</aside>
    <article class="reader-text">${c.epigraph ? `<blockquote>${c.epigraph.lines.map(esc).join('<br>')}<cite>${esc(c.epigraph.attribution)}</cite></blockquote>` : ''}${reading}
    <section class="ruled">${sectionHead('Try next')}${tryNext
      .map((rec) => {
        const a = assignments.find((a) => a.id === rec.assignment);
        return `<a class="recommend" href="${assignmentURL(a.id)}"><b>${esc(a.title)}</b><small>${esc(a.contributor)} · PDF ${range(a.pdfPages)}</small><p>${esc(rec.why)}</p></a>`;
      })
      .join('')}</section>
    ${c.id === 'ob-04' ? '<a class="btn primary" href="subjects.html">Start your subject list → Subjects</a>' : ''}</article></div>`;
  Q('#toggle-sidebar').onclick = () => {
    sidebarHidden = !sidebarHidden;
    Q('#toc').hidden = sidebarHidden;
    Q('.reading-layout').classList.toggle('wide', sidebarHidden);
    Q('#toggle-sidebar').textContent =
      (sidebarHidden ? 'Show' : 'Hide') + ' segments';
    Q('#toggle-sidebar').setAttribute('aria-expanded', String(!sidebarHidden));
  };
  for (const input of QA('[data-segment]'))
    input.onchange = () => {
      setSegmentRead(input.dataset.segment, input.checked);
      Q('[data-check="' + input.dataset.segment + '"]').textContent =
        input.checked ? '✓' : '○';
    };
  if (location.hash)
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
startPage(reader);
