let uploading = false;
async function assignment() {
  const [all, chapters, guide, bios] = await bookData(
    'assignments',
    'chapters',
    'guide',
    'bios'
  );
  const a = all.find((x) => x.id === params.get('id'));
  if (!a) throw Error('Choose an assignment from Playbook.');
  document.title = 'PhotoClass: Subject — ' + a.title;
  const p = getProgress(),
    photos = photosFor(p, a.id),
    state = assignmentState(p, a.id),
    bio = bios[a.bioId];
  const reference = (id) => all.find((x) => x.id === id);
  const suggested = chapters.filter((c) =>
    guide[c.id].tryNext.some((rec) => rec.assignment === a.id)
  );
  app.innerHTML = `<a class="crumb" href="playbook.html">Playbook</a><header class="heading"><div><p class="eyebrow">Assignment ${String(a.seq).padStart(3, '0')} / 307</p><h1>${esc(a.title)}</h1><p class="byline">${esc(a.contributor)}</p></div></header>
    <div class="detail-layout"><article class="prose-body">${a.blocks
      .map((b) =>
        b.kind === 'list'
          ? `<ul class="${b.format === 'word-search' ? 'word-search' : ''}">${b.items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`
          : `<p class="${b.format === 'verse' ? 'verse' : ''}">${esc(b.text)}</p>`
      )
      .join('')}
    ${a.seeAlso.length ? `<section class="subsection"><h3>See also</h3><div class="chips">${a.seeAlso.map((ref) => (ref.id ? `<a href="${assignmentURL(ref.id)}">${esc(reference(ref.id)?.contributor || ref.raw)}</a>` : `<span>${esc(ref.raw)} (see original)</span>`)).join('')}</div></section>` : ''}
    ${
      bio
        ? `<details class="intro"><summary>About the contributor</summary>${bio.text
            .split(/\n\n+/)
            .map((s) => `<p>${esc(s)}</p>`)
            .join('')}</details>`
        : ''
    }
    </article><aside class="details-panel"><h3>Assignment details</h3><p>${pages(a)}</p><a class="btn" href="${bookURL('playbook', a.printedPages[0])}">Open original page</a>
    <label>Status<select id="assignment-status">${Object.entries(statusLabels)
      .map(
        ([k, v]) =>
          `<option value="${k}" ${state.status === k ? 'selected' : ''}>${v}</option>`
      )
      .join('')}</select></label>
    ${a.topics.length ? `<h4>Subject Guide</h4><div class="chips">${a.topics.map((t) => `<a href="playbook.html?topic=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>` : ''}
    ${suggested.length ? `<h4>Suggested after</h4>${suggested.map((c) => `<a class="text-link" href="${chapterURL(c.id)}">${esc(c.title)}</a>`).join(' ')}` : ''}</aside></div>
    <section class="ruled" id="photos"><div class="section-head"><h2>Photos <small>${photos.length} / ${StudyPhotos.MAX_PHOTOS}</small></h2><label class="btn" id="upload-label" for="photo-files">Add photos</label><input class="file-input" id="photo-files" type="file" accept="image/*" multiple></div>
    <p id="upload-reason" class="muted"></p><progress id="upload-progress" aria-label="Upload progress" max="1" value="0" ${uploading ? '' : 'hidden'}></progress>
    <div class="photo-grid">${photos
      .map(
        ([
          id,
          f,
        ]) => `<figure><button class="thumb" data-light="${esc(id)}"><img src="${photoURL(f.thumbUrl)}" alt="${esc(f.caption || 'Assignment photo')}" loading="lazy" decoding="async"></button><figcaption>
    <label>Taken on<input type="date" data-date="${esc(id)}" value="${esc(f.takenOn)}"></label><label>Caption<input maxlength="140" data-caption="${esc(id)}" value="${esc(f.caption)}"></label>
    <button class="text-btn" data-delete="${esc(id)}">Delete photo</button></figcaption></figure>`
      )
      .join('')}</div></section>
    <dialog id="lightbox"><button class="btn" id="close-light">Close</button><img id="full-photo" alt="" loading="lazy" decoding="async"><p id="light-caption"></p></dialog>`;
  Q('#assignment-status').onchange = (e) => {
    setAssignmentStatus(a.id, e.target.value);
    notice('Assignment status saved.');
  };
  function availability() {
    const settings = StudyPhotos.availability(),
      full = photos.length >= StudyPhotos.MAX_PHOTOS;
    const enabled = settings.enabled && !full && !uploading;
    Q('#photo-files').disabled = !enabled;
    Q('#upload-label').classList.toggle('disabled', !enabled);
    Q('#upload-reason').textContent = full
      ? 'This assignment has reached its photo limit.'
      : settings.reason ||
        (photos.length ? '' : 'Add your first photo to this assignment.');
  }
  window.onPhotoAvailability = availability;
  availability();
  Q('#photo-files').onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    uploading = true;
    availability();
    Q('#upload-progress').hidden = false;
    try {
      const result = await StudyPhotos.uploadFiles(a.id, files, {
        onProgress: (f) => {
          const bar = Q('#upload-progress');
          if (bar) bar.value = f;
        },
      });
      notice(
        result.failed.length
          ? result.failed.map((x) => x.name + ' — ' + x.error).join(' · ')
          : 'Photos saved.'
      );
    } catch (error) {
      handleError(error);
    } finally {
      uploading = false;
      await assignment();
    }
  };
  for (const field of QA('[data-date],[data-caption]'))
    field.onchange = () => {
      try {
        const id = field.dataset.date || field.dataset.caption,
          key = field.dataset.date ? 'takenOn' : 'caption';
        StudyPhotos.updatePhoto(a.id, id, { [key]: field.value });
        notice('Photo details saved.');
      } catch (error) {
        handleError(error);
      }
    };
  for (const button of QA('[data-delete]'))
    button.onclick = async () => {
      if (!confirm('Delete this photo and its two stored images?')) return;
      button.disabled = true;
      try {
        await StudyPhotos.deletePhoto(a.id, button.dataset.delete);
        await assignment();
        notice('Photo deleted.');
      } catch (error) {
        button.disabled = false;
        handleError(error);
      }
    };
  const dialog = Q('#lightbox');
  for (const btn of QA('[data-light]'))
    btn.onclick = () => {
      const f = state.photos[btn.dataset.light];
      Q('#full-photo').src = photoURL(f.displayUrl).replaceAll('&amp;', '&');
      Q('#full-photo').alt = f.caption || 'Assignment photo';
      Q('#light-caption').textContent = f.caption;
      dialog.showModal();
    };
  Q('#close-light').onclick = () => dialog.close();
  dialog.onclick = (e) => {
    if (e.target === dialog) dialog.close();
  };
}
for (const event of ['photoclass-sync-status', 'online', 'offline'])
  window.addEventListener(event, () => window.onPhotoAvailability?.());
startPage(assignment);
