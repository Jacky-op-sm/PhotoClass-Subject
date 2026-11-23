async function dashboard() {
  const [assignments, chapters, guide] = await bookData(
    'assignments',
    'chapters',
    'guide'
  );
  const p = getProgress(),
    states = p.playbook.assignments;
  const current = assignments.find((a) => states[a.id]?.status === 'current');
  const photos = assignments
    .flatMap((a) => photosFor(p, a.id).map(([, photo]) => ({ a, photo })))
    .sort((x, y) => y.photo.createdAt.localeCompare(x.photo.createdAt));
  const segments = chapters
    .filter((c) => c.type === 'core')
    .flatMap((c) => guide[c.id].segments.map((s) => ({ s, c })));
  const read = segments.filter(
    ({ s }) => p.onbeing.segments[s.id]?.read
  ).length;
  const next = segments.find(({ s }) => !p.onbeing.segments[s.id]?.read);
  const recent = sortedSubjects(p)
    .sort(([, a], [, b]) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const week =
    1 +
    Math.max(
      0,
      Math.floor((Date.parse(localDay()) - Date.parse(p.startedAt)) / 604800000)
    );
  const done = Object.values(states).filter((a) => a.status === 'done').length;
  app.innerHTML = `<header class="heading"><div><p class="eyebrow">${esc(new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()))}</p><h1>This Week</h1></div>
    <div class="metrics"><span><b>${week}</b>Week</span><span><b>${done}</b>Completed</span><span><b>${photos.length}</b>Photos</span></div></header>
    <div class="workbench"><section class="feature assignment-feature"><div class="feature-copy"><p class="eyebrow">This week's assignment</p>
    <h2>${esc(current?.title || 'Choose an assignment')}</h2><p>${current ? esc(current.contributor) + ' · Started ' + dateLabel(states[current.id].currentSince || states[current.id].statusAt) + ' · ' + photosFor(p, current.id).length + ' photos' : 'Draw from the 307 assignments in The Photographer’s Playbook.'}</p>
    <div class="actions">${current ? `<a class="btn primary" href="${assignmentURL(current.id)}">Open</a><button id="done" class="btn">Mark done</button><button id="draw" class="text-btn">Draw another</button>` : `<button id="draw" class="btn primary">Draw one</button><a class="text-link" href="playbook.html">Browse Playbook</a>`}</div></div>
    <img class="book-cover" src="assets/images/photographers-playbook.jpg" alt="The Photographer’s Playbook cover"></section>
    <section class="feature reading-feature"><div class="feature-copy"><p class="eyebrow">On Being a Photographer</p><h2>${esc(next?.c.title || 'Reading complete')}</h2>
    <p>${next ? esc(next.s.title) + ' · PDF ' + range(next.s.pages) : 'All core segments are marked as read.'}</p>
    ${progressBar(read, segments.length)}<div class="reading-action"><small>${read} of ${segments.length} segments</small><a class="text-link" href="${next ? chapterURL(next.c.id, next.s.id) : 'onbeing.html'}">${next ? 'Continue' : 'Review'}</a></div></div>
    <img class="book-cover" src="assets/images/on-being-a-photographer.jpg" alt="On Being a Photographer cover"></section></div>
    <section class="ruled">${sectionHead('Subjects', 'subjects.html', 'View all subjects')}${subjectForm()}
    ${recent.map(([, s]) => `<p class="subject-line">${s.starred ? '★ ' : ''}${esc(s.text)}</p>`).join('')}</section>
    <section class="ruled">${sectionHead('Recent photos')}${
      photos.length
        ? `<div class="photo-grid">${photos
            .slice(0, 8)
            .map(
              ({ a, photo }) =>
                `<a href="${assignmentURL(a.id)}"><img src="${photoURL(photo.thumbUrl)}" alt="${esc(photo.caption || a.title)}" loading="lazy" decoding="async"><small>${esc(a.title)}</small></a>`
            )
            .join('')}</div>`
        : '<p class="muted">Photos you add to assignments will appear here.</p>'
    }</section>
    <details id="sync-settings" class="settings"><summary>Sync settings &amp; progress backups</summary><div class="settings-inner"><div><h3>Sync settings</h3>
    <p class="muted" data-sync-status></p><label for="sync-code">Sync code</label>
    <input type="password" id="sync-code" autocomplete="off" spellcheck="false" placeholder="Enter your private code">
    <div class="actions"><button class="btn" id="connect">Save code</button><button class="btn" id="generate">Generate</button><button class="btn" id="disconnect">Clear code</button></div><p class="muted" id="sync-feedback"></p></div>
    <div><h3>Progress backups</h3><p class="muted">Includes reading marks, assignments, subjects and private photo links.</p><div class="actions"><button class="btn" id="export">Export progress</button><label class="btn" for="import-file">Import progress</label><input class="file-input" id="import-file" type="file" accept=".json,application/json"></div></div></div></details>`;
  Q('#draw').onclick = () => draw(assignments, getProgress());
  if (current)
    Q('#done').onclick = () => {
      setAssignmentStatus(current.id, 'done');
      dashboard();
      notice('Assignment marked done.');
    };
  bindSubjectForm(dashboard);
  Q('#export').onclick = () => {
    const url = URL.createObjectURL(
      new Blob([exportProgress()], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'photoclass-subject-' + localDay() + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  Q('#import-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Replace progress on this device with this backup?')) {
      e.target.value = '';
      return;
    }
    const result = importProgress(await file.text());
    if (result.success) {
      await dashboard();
      notice('Progress restored.');
    } else notice(result.error);
  };
  Q('#generate').onclick = () => {
    const input = Q('#sync-code');
    input.value = PhotoClassSync.generateSyncCode();
    input.type = 'text';
    input.select();
    Q('#sync-feedback').textContent =
      'Save this code in your password manager and Firebase rules, then choose Save code.';
  };
  Q('#connect').onclick = async () => {
    try {
      await PhotoClassSync.setSyncCode(Q('#sync-code').value.trim());
      Q('#sync-code').value = '';
      Q('#sync-code').type = 'password';
      Q('#sync-feedback').textContent = PhotoClassSync.getStatus().message;
    } catch (error) {
      Q('#sync-feedback').textContent = error.message;
    }
  };
  Q('#disconnect').onclick = () => {
    PhotoClassSync.clearSyncCode();
    Q('#sync-code').value = '';
    Q('#sync-feedback').textContent = 'Code cleared on this browser.';
  };
  if (location.hash === '#sync-settings') {
    Q('#sync-settings').open = true;
    Q('#sync-settings').scrollIntoView();
  }
  updateSyncStatus();
}
window.addEventListener('hashchange', () => {
  if (location.hash === '#sync-settings' && Q('#sync-settings'))
    Q('#sync-settings').open = true;
});
startPage(dashboard);
