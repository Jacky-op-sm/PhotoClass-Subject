(() => {
  'use strict';

  const books = {
    onbeing: { title: 'On Being a Photographer', src: 'source/on-being-a-photographer.pdf', home: 'onbeing.html' },
    playbook: { title: 'The Photographer’s Playbook', src: 'source/photographers-playbook.pdf', home: 'playbook.html' },
  };
  const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5];
  const workerURL = 'assets/vendor/pdfjs-3.11.174/pdf.worker.min.js';

  function returnTarget(params, fallback) {
    for (const value of [params.get('from'), document.referrer]) {
      if (!value) continue;
      try {
        const candidate = new URL(value, location.href);
        if (candidate.origin === location.origin &&
            candidate.pathname.startsWith(new URL('.', location.href).pathname) &&
            /\/(?:chapter|assignment|onbeing|playbook|subjects|index)\.html$/.test(candidate.pathname)) {
          return candidate.pathname + candidate.search + candidate.hash;
        }
      } catch { /* A malformed source link can use the book home. */ }
    }
    return fallback;
  }

  function mount() {
    const app = document.getElementById('app');
    if (!app) return;
    const params = new URLSearchParams(location.search);
    const key = params.get('book') || 'onbeing';
    if (!Object.hasOwn(books, key)) {
      app.textContent = 'This book is unavailable.';
      return;
    }
    const book = books[key];
    const style = document.createElement('style');
    style.textContent = `
      .pdf-reader {width:min(100%,1000px);margin:0 auto;padding:1.6rem clamp(.75rem,3vw,2.5rem) 3rem;min-width:0}
      .pdf-reader h1 {font-size:clamp(1.45rem,3vw,2.4rem);line-height:1.15;margin:.45rem 0 .7rem}
      .pdf-back {display:inline-flex;align-items:center;min-height:44px;color:var(--text-secondary,#515154)}
      .pdf-controls {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.45rem 1rem;margin:.8rem 0}
      .pdf-tools, .pdf-pager {display:flex;align-items:center;flex-wrap:wrap;gap:.35rem}
      .pdf-reader button,.pdf-reader input {min-height:44px;border:1px solid var(--border-medium,#cbcbd0);border-radius:.5rem;background:#fff;color:#242426;font:inherit}
      .pdf-reader button {min-width:44px;padding:.35rem .65rem;cursor:pointer}
      .pdf-reader button:disabled {opacity:.42;cursor:default}
      .pdf-pager label {display:flex;align-items:center;gap:.4rem;font-weight:600}
      .pdf-pager input {width:4ch;box-sizing:content-box;padding:0 .45rem;text-align:center;font-variant-numeric:tabular-nums}
      .pdf-reader :focus-visible {outline:2px solid #1767ad;outline-offset:2px}
      .pdf-position {font-size:1.08rem;color:var(--text-secondary,#515154)}
      .pdf-position strong {color:var(--text-primary,#202021)}
      .pdf-message {font-size:.95rem;min-height:1.5em}
      .pdf-retry[hidden]{display:none}
      .pdf-sheet {width:100%;min-width:0;overflow:auto;overscroll-behavior-x:contain;background:#e8e8ea;border:1px solid #d4d4d6;border-radius:.3rem}
      .pdf-sheet canvas {display:block;max-width:none;margin:0 auto;background:#fff}
      .pdf-sheet:empty {display:none}
    `;
    document.head.append(style);
    app.innerHTML = `
      <article class="pdf-reader">
        <a class="pdf-back">Back</a>
        <h1></h1>
        <p class="pdf-position" aria-live="polite"><strong></strong><span></span></p>
        <div class="pdf-controls">
          <form class="pdf-pager" aria-label="Page navigation">
            <button type="button" data-action="previous" aria-label="Previous page" title="Previous page">‹</button>
            <label>PDF page <input type="text" inputmode="numeric" pattern="[0-9]+" required autocomplete="off"></label>
            <button type="submit">Go</button>
            <button type="button" data-action="next" aria-label="Next page" title="Next page">›</button>
          </form>
          <div class="pdf-tools" role="group" aria-label="Zoom">
            <button type="button" data-action="out" aria-label="Zoom out">−</button>
            <button type="button" data-action="fit" title="Reset to fit width">Fit width</button>
            <button type="button" data-action="in" aria-label="Zoom in">+</button>
          </div>
        </div>
        <p class="pdf-message" role="status">Opening book…</p>
        <button type="button" class="pdf-retry" hidden>Try again</button>
        <div class="pdf-sheet" aria-label="Original page"></div>
      </article>`;
    const get = selector => app.querySelector(selector);
    const action = name => get('[data-action="' + name + '"]');
    const back = get('.pdf-back');
    back.href = returnTarget(params, book.home);
    back.textContent = /chapter\.html/.test(back.pathname) ? 'Back to chapter' :
      /assignment\.html/.test(back.pathname) ? 'Back to assignment' : 'Back to book';
    get('h1').textContent = book.title;

    const sheet = get('.pdf-sheet');
    const message = get('.pdf-message');
    const input = get('.pdf-pager input');
    const retry = get('.pdf-retry');
    let documentPDF;
    let loadTask;
    let map;
    let number = 1;
    let zoom = 2;
    let generation = 0;
    let renderTask;
    let drawnWidth = 0;
    let resizeTimer;

    function printedPage() {
      return key === 'onbeing' ? number : map[number];
    }

    function updateControls() {
      const ready = Boolean(documentPDF);
      input.disabled = !ready;
      get('[type="submit"]').disabled = !ready;
      action('previous').disabled = !ready || number <= 1;
      action('next').disabled = !ready || number >= documentPDF.numPages;
      action('in').disabled = !ready || zoom === zoomLevels.length - 1;
      action('out').disabled = !ready || zoom === 0;
      action('fit').disabled = !ready;
      action('fit').textContent = zoom === 2 ? 'Fit width' : Math.round(zoomLevels[zoom] * 100) + '% · Fit';
      if (!ready) return;
      input.value = String(number);
      input.setCustomValidity('');
      get('.pdf-position strong').textContent = 'PDF ' + number;
      const printed = printedPage();
      get('.pdf-position span').textContent = printed == null ? ' · Unnumbered page' : ' · p. ' + printed;
    }

    function updateURL() {
      const url = new URL(location.href);
      url.searchParams.set('book', key);
      if (!url.searchParams.has('from')) url.searchParams.set('from', back.pathname + back.search + back.hash);
      const printed = printedPage();
      url.searchParams.delete(printed == null ? 'page' : 'pdfPage');
      url.searchParams.set(printed == null ? 'pdfPage' : 'page', printed ?? number);
      history.replaceState(history.state, '', url);
    }

    function renderWidth() {
      return Math.max(1, get('.pdf-controls').clientWidth - 2);
    }

    async function render() {
      const current = ++generation;
      if (renderTask) renderTask.cancel();
      renderTask = null;
      retry.hidden = true;
      message.textContent = 'Rendering PDF ' + number + '…';
      sheet.setAttribute('aria-busy', 'true');
      const pageNumber = number;
      const width = renderWidth();
      drawnWidth = width;
      try {
        const page = await documentPDF.getPage(pageNumber);
        if (current !== generation) return;
        const unit = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width * zoomLevels[zoom] / unit.width });
        // Bound the bitmap on high-density iPhones while preserving its CSS dimensions.
        const dpr = Math.min(window.devicePixelRatio || 1,
          Math.sqrt(16000000 / (viewport.width * viewport.height)));
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width * dpr);
        canvas.height = Math.ceil(viewport.height * dpr);
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', book.title + ', PDF page ' + pageNumber);
        renderTask = page.render({
          canvasContext: canvas.getContext('2d', { alpha: false }),
          viewport,
          transform: [dpr, 0, 0, dpr, 0, 0],
        });
        await renderTask.promise;
        if (current !== generation) return;
        sheet.replaceChildren(canvas);
        message.textContent = '';
      } catch (error) {
        if (current !== generation || error.name === 'RenderingCancelledException') return;
        sheet.replaceChildren();
        message.textContent = 'This page could not be rendered.';
        retry.hidden = false;
      } finally {
        if (current === generation) {
          renderTask = null;
          sheet.setAttribute('aria-busy', 'false');
        }
      }
    }

    function moveTo(next) {
      if (!documentPDF || next < 1 || next > documentPDF.numPages) return;
      number = next;
      updateControls();
      updateURL();
      return render();
    }

    function setZoom(next) {
      if (next === zoom || next < 0 || next >= zoomLevels.length) return;
      zoom = next;
      updateControls();
      render();
    }

    async function open() {
      updateControls();
      retry.hidden = true;
      message.textContent = 'Opening book…';
      try {
        if (!window.pdfjsLib) throw new Error('PDF library unavailable');
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerURL;
        const url = new URL(book.src, document.baseURI);
        loadTask = pdfjsLib.getDocument({ url: url.href, isEvalSupported: false,
          disableRange: ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) });
        const mapRequest = key === 'playbook' ? fetch('content/playbook/page-map.json').then(response => {
          if (!response.ok) throw new Error('Missing page map');
          return response.json();
        }) : null;
        const [pdf, pageMap] = await Promise.all([loadTask.promise, mapRequest]);
        map = pageMap;
        const printed = params.get('page');
        const physical = params.get('pdfPage');
        const mapped = key === 'playbook' && printed !== null ?
          Object.keys(map).find(n => map[n] !== null && map[n] === Number(printed)) : null;
        const target = printed !== null ? (key === 'onbeing' ? Number(printed) : Number(mapped)) :
          (physical === null ? 1 : Number(physical));
        if (!Number.isInteger(target) || target < 1 || target > pdf.numPages) {
          documentPDF = pdf;
          await moveTo(1);
          if (number === 1) message.textContent = 'Requested page unavailable. Showing the first page.';
          return;
        }
        documentPDF = pdf;
        moveTo(target);
      } catch {
        documentPDF = null;
        if (loadTask) await loadTask.destroy().catch(() => {});
        message.textContent = 'Could not open this book. Check your connection and try again.';
        retry.hidden = false;
      }
    }

    get('.pdf-pager').addEventListener('submit', event => {
      event.preventDefault();
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < 1 || value > documentPDF.numPages) {
        input.setCustomValidity('Enter a PDF page from 1 to ' + documentPDF.numPages + '.');
        input.reportValidity();
        return;
      }
      moveTo(value);
    });
    input.addEventListener('input', () => input.setCustomValidity(''));
    action('previous').addEventListener('click', () => moveTo(number - 1));
    action('next').addEventListener('click', () => moveTo(number + 1));
    action('in').addEventListener('click', () => setZoom(zoom + 1));
    action('out').addEventListener('click', () => setZoom(zoom - 1));
    action('fit').addEventListener('click', () => setZoom(2));
    retry.addEventListener('click', () => {
      if (documentPDF) render();
      else if (!window.pdfjsLib) location.reload();
      else open();
    });
    document.addEventListener('keydown', event => {
      if (!documentPDF || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
          event.shiftKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const delta = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!delta) return;
      event.preventDefault();
      moveTo(number + delta);
    });
    const observer = new ResizeObserver(() => {
      if (!documentPDF || Math.abs(renderWidth() - drawnWidth) < 1) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 100);
    });
    observer.observe(get('.pdf-controls'));
    open();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
