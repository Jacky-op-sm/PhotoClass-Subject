(() => {
  'use strict';

  const books = {
    onbeing: { title: 'On Being a Photographer', src: 'source/on-being-a-photographer.pdf', home: 'onbeing.html' },
    playbook: { title: 'The Photographer’s Playbook', src: 'source/photographers-playbook.pdf', home: 'playbook.html' },
  };
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
      [data-page="pdf"] .page-shell {padding-top:24px;padding-bottom:40px}
      .pdf-reader {max-width:1080px;margin:auto;min-width:0}
      .pdf-heading {display:flex;align-items:baseline;justify-content:space-between;gap:4px 16px;flex-wrap:wrap}
      .pdf-heading h1 {font:600 var(--t21)/1.38 var(--display);letter-spacing:.011em;margin:0}
      .pdf-back {display:inline-flex;align-items:center;min-height:36px;font-size:var(--t14);white-space:nowrap}
      .pdf-back::before {content:'';width:.42em;height:.42em;margin-right:.4em;border-bottom:1.5px solid currentColor;border-left:1.5px solid currentColor;transform:rotate(45deg)}
      .pdf-controls {display:flex;align-items:center;gap:4px;width:fit-content;max-width:100%;margin:12px auto 16px;padding:3px 4px;border-radius:var(--r-pill);background:var(--fill)}
      .pdf-pager,.pdf-pager label {display:flex;align-items:center}
      .pdf-pager {gap:4px;min-width:0;font-size:var(--t14);font-variant-numeric:tabular-nums;white-space:nowrap}
      .pdf-pager label {gap:6px;padding-left:2px;color:var(--ink-2)}
      .pdf-reader button {display:inline-grid;place-items:center;min-width:32px;min-height:32px;padding:0 12px;border-radius:var(--r-pill);color:var(--ink);font-size:var(--t14);cursor:pointer}
      .pdf-reader button:hover:not(:disabled),.pdf-reader button[aria-pressed="true"] {background:var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.12)}
      .pdf-reader button:disabled {opacity:.35;cursor:default}
      .pdf-reader button[data-action="previous"],.pdf-reader button[data-action="next"] {padding:0;font:400 1.4rem/1 var(--sans)}
      .pdf-reader button[data-action="fit"] {margin-left:6px;white-space:nowrap}
      .pdf-pager label > input[type="text"] {width:44px;min-height:28px;margin:0;padding:0 4px;border:0;border-radius:var(--r);background:var(--surface);text-align:center;color:var(--ink)}
      .pdf-count,.pdf-printed {color:var(--ink-2)}
      .pdf-stage {position:relative}
      .pdf-message {position:absolute;top:12px;left:12px;z-index:1;padding:4px 12px;border-radius:var(--r-pill);background:var(--surface);color:var(--ink);font-size:var(--t14)}
      .pdf-message:empty {display:none}
      .pdf-retry {margin:48px 0 0 12px}
      .pdf-sheet {width:100%;min-width:0;overflow:auto;padding:16px 0;border-radius:var(--r-card);background:var(--bg)}
      .pdf-sheet canvas {display:block;max-width:none;margin:0 auto;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.08)}
      @media (max-width:470px) {
        .pdf-pager {gap:2px}
        .pdf-pager label {gap:4px}
        .pdf-reader button[data-action="fit"] {padding:0 8px}
      }
      @media (max-width:340px) {
        .pdf-controls {flex-wrap:wrap;border-radius:var(--r-card)}
      }
    `;
    document.head.append(style);
    app.innerHTML = `
      <article class="pdf-reader">
        <div class="pdf-heading"><h1></h1><a class="pdf-back">Back</a></div>
        <div class="pdf-controls">
          <form class="pdf-pager" aria-label="Page navigation">
            <button type="button" data-action="previous" aria-label="Previous page" title="Previous page">‹</button>
            <label>PDF <input type="text" aria-label="PDF page" inputmode="numeric" pattern="[0-9]+" required autocomplete="off" enterkeyhint="go"></label>
            <span class="pdf-count"></span><span class="pdf-printed"></span>
            <button type="button" data-action="next" aria-label="Next page" title="Next page">›</button>
          </form>
          <button type="button" data-action="fit" aria-pressed="false">Fit width</button>
        </div>
        <div class="pdf-stage">
          <div class="pdf-sheet" aria-label="Original page"></div>
          <p class="pdf-message" role="status">Opening book…</p>
          <button type="button" class="pdf-retry" hidden>Try again</button>
        </div>
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
    let fitWidth = false;
    let generation = 0;
    let renderTask;
    let lastSize;
    let resizeTimer;

    function printedPage() {
      return key === 'onbeing' ? number : map[number];
    }

    function updateControls() {
      const ready = Boolean(documentPDF);
      input.disabled = !ready;
      action('previous').disabled = !ready || number <= 1;
      action('next').disabled = !ready || number >= documentPDF.numPages;
      action('fit').disabled = !ready;
      action('fit').setAttribute('aria-pressed', String(fitWidth));
      action('fit').title = fitWidth ? 'Show the whole page' : 'Fill the available width';
      if (!ready) return;
      input.value = String(number);
      input.setCustomValidity('');
      get('.pdf-count').textContent = '/ ' + documentPDF.numPages;
      const printed = printedPage();
      const label = get('.pdf-printed');
      label.textContent = printed == null ? '· —' : '· p. ' + printed;
      label.title = printed == null ? 'Unnumbered page' : 'Printed page ' + printed;
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

    function availableSize() {
      const top = sheet.getBoundingClientRect().top + window.scrollY;
      const height = (window.visualViewport?.height ?? window.innerHeight) - top - 12;
      return { width: Math.max(1, sheet.clientWidth), height: Math.max(1, Math.floor(height)) };
    }

    async function render() {
      const current = ++generation;
      if (renderTask) renderTask.cancel();
      renderTask = null;
      retry.hidden = true;
      message.textContent = 'Rendering PDF ' + number + '…';
      sheet.setAttribute('aria-busy', 'true');
      const pageNumber = number;
      const size = availableSize();
      lastSize = size;
      try {
        const page = await documentPDF.getPage(pageNumber);
        if (current !== generation) return;
        const unit = page.getViewport({ scale: 1 });
        const widthScale = size.width / unit.width;
        const scale = fitWidth ? widthScale : Math.min(widthScale, size.height / unit.height);
        const viewport = page.getViewport({ scale });
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

    function applyInput(showError) {
      if (!documentPDF) return;
      const value = Number(input.value);
      if (!/^\d+$/.test(input.value) || value < 1 || value > documentPDF.numPages) {
        if (showError) {
          input.setCustomValidity('Enter a PDF page from 1 to ' + documentPDF.numPages + '.');
          input.reportValidity();
        } else {
          input.value = String(number);
          input.setCustomValidity('');
        }
        return;
      }
      if (value !== number) moveTo(value);
      else input.value = String(number);
    }

    get('.pdf-pager').addEventListener('submit', event => {
      event.preventDefault();
      applyInput(true);
    });
    input.addEventListener('blur', () => applyInput(false));
    input.addEventListener('input', () => input.setCustomValidity(''));
    action('previous').addEventListener('click', () => moveTo(number - 1));
    action('next').addEventListener('click', () => moveTo(number + 1));
    action('fit').addEventListener('click', () => {
      fitWidth = !fitWidth;
      updateControls();
      render();
    });
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
    function resize() {
      if (!documentPDF) return;
      const size = availableSize();
      if (lastSize && size.width === lastSize.width && (fitWidth || size.height === lastSize.height)) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 80);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(get('.pdf-controls'));
    observer.observe(get('.pdf-heading'));
    const header = document.querySelector('.site-header');
    if (header) observer.observe(header);
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    open();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
