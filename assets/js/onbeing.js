startPage(async () => {
  const [chapters, guide] = await bookData('chapters', 'guide');
  const marks = getProgress().onbeing.segments;
  const rows = chapters
    .map((c, i) => {
      const segments = guide[c.id].segments;
      const read = segments.filter((s) => marks[s.id]?.read).length;
      const state = read
        ? read === segments.length
          ? 'Done'
          : 'In progress'
        : '';
      const progress = read
        ? `${read}/${segments.length} segments`
        : `${segments.length} segments`;
      const meta = [`PDF&nbsp;${range(c.printedPages)}`, progress];
      if (c.type === 'reference') meta.push('Reference');
      return `<a class="chapter-row" href="${chapterURL(c.id)}"><span class="ordinal">${String(i + 1).padStart(2, '0')}</span><div><h2>${esc(c.title)}</h2><small>${meta.join(' · ')}</small></div>${state ? `<span class="list-status">${state}</span>` : ''}</a>`;
    })
    .join('');
  app.innerHTML = `<header class="book-heading"><h1>On Being a Photographer</h1><p>David Hurn &amp; Bill Jay</p></header><div class="chapter-list">${rows}</div>`;
});
