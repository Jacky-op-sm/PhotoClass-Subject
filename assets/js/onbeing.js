startPage(async () => {
  const [chapters, guide] = await bookData('chapters', 'guide'),
    p = getProgress();
  app.innerHTML = `<header class="book-heading"><img src="assets/images/on-being-a-photographer.jpg" alt="On Being a Photographer cover"><div><p class="eyebrow">Reading · 10 core chapters</p><h1>On Being a Photographer</h1><p>David Hurn &amp; Bill Jay</p></div></header>
    <div class="chapter-list">${chapters
      .map((c, i) => {
        const segs = guide[c.id].segments,
          n = segs.filter((s) => p.onbeing.segments[s.id]?.read).length;
        const state =
          c.type === 'reference'
            ? 'Reference'
            : n === 0
              ? 'Not started'
              : n === segs.length
                ? 'Done'
                : 'In progress';
        return `<a class="chapter-row" href="${chapterURL(c.id)}"><span class="ordinal">${String(i + 1).padStart(2, '0')}</span><div><h2>${esc(c.title)}</h2><small>PDF ${range(c.printedPages)} · ${n}/${segs.length} segments</small></div><span class="badge">${state}</span></a>`;
      })
      .join('')}</div>`;
});
