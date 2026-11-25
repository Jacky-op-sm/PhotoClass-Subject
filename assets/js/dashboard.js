function renderRecentPhotos(section, assignments, current) {
  const progress = getProgress();
  const photos = assignments
    .flatMap((a) =>
      photosFor(progress, a.id).map(([id, photo]) => ({ a, id, photo }))
    )
    .sort((x, y) => y.photo.createdAt.localeCompare(x.photo.createdAt))
    .slice(0, 8);
  if (current) {
    const count = photosFor(progress, current.id).length;
    Q('#assignment-photo-count').textContent = count
      ? ' · ' + count + (count === 1 ? ' photo' : ' photos')
      : '';
  }
  section.innerHTML = StudyPhotos.controls() + (photos.length
    ? `<div class="photo-grid">${photos
        .map(
          ({ a }, i) =>
            `<a href="${assignmentURL(a.id)}#photos"><span class="photo-preview" data-recent="${i}"></span><small>${esc(a.title)}</small></a>`
        )
        .join('')}</div>`
    : '<p class="muted">Photos you add to assignments will appear here.</p>');
  StudyPhotos.bindControls(dashboard);
  for (const host of QA('[data-recent]', section)) {
    const { a, id, photo } = photos[Number(host.dataset.recent)];
    StudyPhotos.showImage(host, photo, id, 'thumb', photo.caption || a.title);
  }
  StudyPhotos.pruneImages();
}

async function dashboard() {
  const [assignments, chapters, guide] = await bookData(
    'assignments',
    'chapters',
    'guide'
  );
  const p = getProgress(),
    states = p.playbook.assignments;
  const current = assignments.find((a) => states[a.id]?.status === 'current');
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
  app.innerHTML = `<header class="heading week-heading"><h1>This Week</h1><p>${esc(new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()))}</p></header>
    <div class="workbench"><section class="feature assignment-feature"><p class="eyebrow">This week's assignment</p>
    <h2>${esc(current?.title || 'Choose an assignment')}</h2><p>${current ? esc(current.contributor) + ' · Started ' + dateLabel(states[current.id].currentSince || states[current.id].statusAt) + '<span id="assignment-photo-count"></span>' : 'Draw from The Photographer’s Playbook.'}</p>
    <div class="actions">${current ? `<a class="btn primary" href="${assignmentURL(current.id)}">Open assignment</a><button id="done" class="text-btn">Mark done</button><button id="draw" class="text-btn">Draw another</button>` : `<button id="draw" class="btn primary">Draw one</button><a class="text-link chevron" href="playbook.html">Browse Playbook</a>`}</div></section>
    <section class="feature reading-feature"><p class="eyebrow">On Being a Photographer</p><h2>${esc(next?.c.title || 'Reading complete')}</h2>
    <p>${next ? esc(next.s.title) + ' · <span class="page-ref">PDF&nbsp;' + range(next.s.pages) + '</span>' : 'All core segments are marked as read.'}</p>
    <div class="reading-action"><a class="btn primary" href="${next ? chapterURL(next.c.id, next.s.id) : 'onbeing.html'}">${next ? 'Continue reading' : 'Review reading'}</a><span class="read-meter">${progressBar(read, segments.length)}<small>${read} of ${segments.length} segments</small></span></div></section></div>
    <section class="ruled">${sectionHead('Subjects', 'subjects.html', 'View all')}<div class="group">${subjectForm()}
    ${recent.map(([, s]) => `<p class="subject-line">${s.starred ? '★ ' : ''}${esc(s.text)}</p>`).join('')}</div></section>
    <section class="ruled">${sectionHead('Recent photos')}<div id="recent-photos"><p class="muted" role="status">Waiting for the local photo folder…</p></div></section>`;
  const photoSection = Q('#recent-photos');
  StudyPhotos.pruneImages();
  StudyPhotos.ready
    .then(() => {
      if (photoSection.isConnected)
        renderRecentPhotos(photoSection, assignments, current);
    })
    .catch((error) => {
      if (!photoSection.isConnected) return;
      photoSection.textContent = 'Recent photos could not be loaded.';
      handleError(error);
    });
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
