'use strict';
const app = document.getElementById('app');
const Q = (selector, root = document) => root.querySelector(selector);
const QA = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  );
const params = new URLSearchParams(location.search);
const jsonPaths = {
  chapters: 'content/onbeing/chapters',
  guide: 'data/onbeing-guide',
  assignments: 'content/playbook/assignments',
  topics: 'content/playbook/topics',
  intro: 'content/playbook/intro',
  bios: 'content/playbook/bios',
};
const jsonCache = new Map();
async function bookData(...names) {
  return Promise.all(
    names.map((name) => {
      if (!jsonCache.has(name))
        jsonCache.set(
          name,
          fetch(jsonPaths[name] + '.json')
            .then((r) => {
              if (!r.ok)
                throw Error(
                  'Book data could not be loaded. Reload to try again.'
                );
              return r.json();
            })
            .catch((error) => {
              jsonCache.delete(name);
              throw error;
            })
        );
      return jsonCache.get(name);
    })
  );
}
const assignmentURL = (id) => 'assignment.html?id=' + encodeURIComponent(id);
const chapterURL = (id, segment = '') =>
  'chapter.html?id=' +
  encodeURIComponent(id) +
  (segment ? '#' + encodeURIComponent(segment) : '');
const bookURL = (book, page, physical = false) =>
  'pdf.html?book=' +
  book +
  (physical ? '&pdfPage=' : '&page=') +
  Number(page) +
  '&from=' +
  encodeURIComponent(location.pathname + location.search + location.hash);
const range = (pair) =>
  pair[0] === pair[1] ? String(pair[0]) : pair.join('–');
const pages = (a) =>
  '<strong>PDF ' +
  range(a.pdfPages) +
  '</strong> · ' +
  (a.printedPages[0] === a.printedPages[1] ? 'p. ' : 'pp. ') +
  range(a.printedPages);
function dateLabel(value) {
  if (typeof value !== 'string') return 'date unavailable';
  const date = new Date(value.length === 10 ? value + 'T12:00:00' : value);
  if (!Number.isFinite(date.getTime())) return 'date unavailable';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
const flatText = (a, separator = ' ') =>
  a.blocks.map((b) => b.text ?? b.items.join(separator)).join(' ');
const sectionHead = (title, link = '', label = '') =>
  '<div class="section-head"><h2>' +
  esc(title) +
  '</h2>' +
  (link
    ? '<a class="text-link chevron" href="' +
      esc(link) +
      '">' +
      esc(label) +
      '</a>'
    : '') +
  '</div>';
function photoURL(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ||
      (['localhost', '127.0.0.1'].includes(u.hostname) &&
        u.protocol === 'http:')
      ? esc(u.href)
      : '';
  } catch {
    return '';
  }
}
function notice(text) {
  const n = Q('#notice');
  n.textContent = text;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => {
    n.textContent = '';
  }, 5000);
}
function handleError(error) {
  notice(error.message || 'Something went wrong. Try again.');
}
function startPage(render) {
  const refresh = () =>
    Promise.resolve()
      .then(render)
      .catch((error) => {
        app.innerHTML =
          '<h1>Unable to open this page</h1><p>' +
          esc(error.message) +
          '</p><a class="btn" href="' +
          esc(location.href) +
          '">Reload</a>';
      });
  window.addEventListener('photoclass-sync-progress-updated', refresh);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) refresh();
  });
  refresh();
}
function randomTodo(results, progress, exclude = '') {
  const choices = results.filter(
    (a) => a.id !== exclude && assignmentState(progress, a.id).status === 'todo'
  );
  if (!choices.length) {
    notice('No to-do assignments match this selection.');
    return null;
  }
  return choices[Math.floor(Math.random() * choices.length)];
}
function draw(results, progress) {
  const a = randomTodo(results, progress);
  if (a) {
    setAssignmentStatus(a.id, 'current');
    location.href = assignmentURL(a.id);
  }
}
function progressBar(value, total) {
  return (
    '<progress value="' +
    value +
    '" max="' +
    total +
    '" aria-label="Reading progress"></progress>'
  );
}
function subjectForm() {
  return '<form class="quick-form" id="add-subject"><label class="sr" for="subject-text">New subject</label><input id="subject-text" required maxlength="200" placeholder="What would you like to photograph?" autocomplete="off"><button class="btn primary">Add subject</button></form>';
}
function bindSubjectForm(refresh) {
  Q('#add-subject').onsubmit = (e) => {
    e.preventDefault();
    try {
      addSubject(Q('#subject-text').value);
      refresh();
      notice('Subject added.');
    } catch (error) {
      handleError(error);
    }
  };
}
function updateSyncStatus() {
  const text = window.PhotoClassSync?.getStatus?.().message || 'Local only';
  const indicator = Q('.sync-indicator');
  if (indicator) {
    Q('span', indicator).textContent = text;
    indicator.classList.toggle(
      'connected',
      !!window.PhotoClassSync?.getStatus?.().authorized
    );
  }
  for (const node of QA('[data-sync-status]')) node.textContent = text;
}
window.addEventListener('photoclass-sync-status', updateSyncStatus);
updateSyncStatus();
