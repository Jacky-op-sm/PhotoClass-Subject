async function subjectsPage() {
  const [assignments] = await bookData('assignments'),
    p = getProgress(),
    entries = sortedSubjects(p);
  app.innerHTML = `<header class="heading"><div><h1>Subjects</h1><p>Keep a list of things you want to photograph, as Hurn and Jay suggest in <a class="text-link" href="${chapterURL('ob-04')}">Selecting a Subject</a>.</p></div></header>
    ${subjectForm()}<div class="subject-list">${
      entries
        .map(
          ([
            id,
            s,
          ]) => `<article class="subject-item"><div><small>${s.kind === 'project' ? 'Project candidate' : 'Interest'}</small><h2>${esc(s.text)}</h2>
    <div class="chips">${(s.links || [])
      .map((key) => {
        const a = assignments.find((a) => a.id === key);
        return a ? `<a href="${assignmentURL(key)}">${esc(a.title)}</a>` : '';
      })
      .join('')}</div></div>
    <div class="actions"><button class="btn" data-star="${esc(id)}" aria-pressed="${s.starred}" aria-label="${s.starred ? 'Unstar' : 'Star'} subject">${s.starred ? '★' : '☆'}</button>
    <button class="btn" data-kind="${esc(id)}">${s.kind === 'interest' ? 'Make project' : 'Mark interest'}</button><button class="btn" data-edit="${esc(id)}">Edit</button><button class="text-btn" data-remove="${esc(id)}">Delete</button></div></article>`
        )
        .join('') ||
      '<p class="empty">Your subject list is empty. Add a place, person or question you keep returning to.</p>'
    }</div>
    <dialog id="editor"><form id="edit-form"><h2>Edit subject</h2><label>Subject<input id="edit-text" maxlength="200" required></label>
    <label>Link assignments<input id="link-search" placeholder="Search by title or contributor" type="search"></label><div id="link-options"></div>
    <div class="actions"><button class="btn primary">Save changes</button><button class="btn" id="cancel-edit" type="button">Cancel</button></div></form></dialog>`;
  bindSubjectForm(subjectsPage);
  function change(id, fn) {
    updateStudy((progress, now) => {
      const s = progress.subjects[id];
      if (!s || s.deleted) return;
      fn(s);
      s.updatedAt = now;
    });
    subjectsPage();
  }
  for (const b of QA('[data-star]'))
    b.onclick = () =>
      change(b.dataset.star, (s) => {
        s.starred = !s.starred;
      });
  for (const b of QA('[data-kind]'))
    b.onclick = () =>
      change(b.dataset.kind, (s) => {
        s.kind = s.kind === 'project' ? 'interest' : 'project';
      });
  for (const b of QA('[data-remove]'))
    b.onclick = () => {
      if (confirm('Delete this subject?'))
        change(b.dataset.remove, (s) => {
          s.deleted = true;
        });
    };
  const dialog = Q('#editor');
  for (const b of QA('[data-edit]'))
    b.onclick = () => {
      const id = b.dataset.edit,
        s = p.subjects[id],
        selected = new Set(s.links);
      Q('#edit-text').value = s.text;
      Q('#link-search').value = '';
      function options() {
        const needle = Q('#link-search').value.trim().toLowerCase();
        const choices = assignments.filter((a) =>
          (a.title + ' ' + a.contributor).toLowerCase().includes(needle)
        );
        choices.sort(
          (a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id))
        );
        Q('#link-options').innerHTML =
          choices
            .slice(0, 40)
            .map(
              (a) =>
                `<label class="check"><input type="checkbox" value="${a.id}" ${selected.has(a.id) ? 'checked' : ''}><span>${esc(a.title)} <small>· ${esc(a.contributor)}</small></span></label>`
            )
            .join('') || '<p>No matching assignments.</p>';
      }
      Q('#link-search').oninput = options;
      Q('#link-options').onchange = (e) => {
        if (e.target.checked) selected.add(e.target.value);
        else selected.delete(e.target.value);
      };
      Q('#edit-form').onsubmit = (e) => {
        e.preventDefault();
        const text = Q('#edit-text').value.trim();
        if (!text) {
          notice('Enter a subject.');
          return;
        }
        dialog.close();
        change(id, (s) => {
          s.text = text;
          s.links = Array.from(selected);
        });
      };
      Q('#cancel-edit').onclick = () => dialog.close();
      options();
      dialog.showModal();
    };
}
startPage(subjectsPage);
