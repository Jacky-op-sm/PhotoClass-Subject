let uploading = false;
function assignmentBlock(block) {
  if (block.kind !== 'list')
    return `<p${block.format === 'verse' ? ' class="verse"' : ''}>${esc(block.text)}</p>`;
  const { items } = block;
  if (block.format === 'word-search')
    return `<ul class="word-search" role="list">${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
  // Use the book's numbers, including continuations after prose and skipped values.
  const numbered = items.map((s) => s.match(/^(?:-\s*)?(\d+)\.\s+(.+)$/s));
  if (numbered.every(Boolean)) {
    return `<ol start="${Number(numbered[0][1])}">${numbered.map(([, n, s]) => `<li value="${Number(n)}">${esc(s)}</li>`).join('')}</ol>`;
  }
  // Mixed labels (e.g. "8–10.", "a)", or "Rule One") carry meaning in the source.
  const printed = items.every((s) =>
    /^(?:(?:\d+(?:[-–]\d+)?|[a-z])[.)]\s+|[-•]\s+|(?:Rule|Number)\s+\w+:)/i.test(
      s
    )
  );
  return `<ul${printed ? ' class="printed-list" role="list"' : ''}>${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
}
function referenceLine(label, links) {
  if (!links.length) return '';
  return `<div class="reference-line"><h2>${esc(label)}</h2><p>${links.join(' <span aria-hidden="true">·</span> ')}</p></div>`;
}
function contributorLink(ref, all) {
  const target = all.find((entry) => entry.id === ref.id);
  const link = (entry) =>
    `<a href="${assignmentURL(entry.id)}">${esc(entry.contributor)}</a>`;
  if (target) return link(target);
  const candidates = all.filter(
    (entry) => entry.contributor.split(/\s+/).at(-1) === ref.raw
  );
  if (candidates.length < 2) return esc(ref.raw);
  return `<span class="ambiguous-ref">${esc(ref.raw)} <small>(${candidates.map(link).join(' or ')})</small></span>`;
}
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
  const suggested = chapters.filter((c) =>
    guide[c.id].tryNext.some((rec) => rec.assignment === a.id)
  );
  const controls = Object.entries(statusLabels)
    .map(
      ([key, label]) =>
        `<label><input type="radio" class="sr" name="status" value="${key}" ${state.status === key ? 'checked' : ''}><span>${label}</span></label>`
    )
    .join('');
  app.innerHTML = `<header class="assignment-heading"><nav class="inline-meta" aria-label="Assignment location"><a href="playbook.html">Playbook</a> · Assignment ${String(a.seq).padStart(3, '0')}</nav>
    <h1>${esc(a.title)}</h1><div class="inline-meta assignment-byline"><span>${esc(a.contributor)}</span> · <span class="page-ref">${pages(a)}</span> · <a href="${bookURL('playbook', a.printedPages[0])}">Open original page</a></div></header>
    <fieldset id="assignment-status"><legend class="sr">Assignment status</legend>${controls}</fieldset>
    <article class="prose-body assignment-text">${a.blocks.map(assignmentBlock).join('')}</article>
    <section class="assignment-references" aria-label="Assignment references">
    ${referenceLine(
      'Subject Guide',
      a.topics.map(
        (t) =>
          `<a href="playbook.html?topic=${encodeURIComponent(t)}">${esc(t)}</a>`
      )
    )}
    ${referenceLine(
      'See also',
      a.seeAlso.map((ref) => contributorLink(ref, all))
    )}
    ${referenceLine(
      'Suggested after',
      suggested.map((c) => `<a href="${chapterURL(c.id)}">${esc(c.title)}</a>`)
    )}
    ${
      bio
        ? `<details class="contributor"><summary>About the contributor</summary>${bio.text
            .split(/\n\n+/)
            .map((s) => `<p>${esc(s)}</p>`)
            .join(
              ''
            )}<p>${bio.sourcePages.map((pair) => `<a href="${bookURL('playbook', pair[0], true)}">PDF&nbsp;${range(pair)}</a>`).join(' · ')}</p></details>`
        : ''
    }</section>
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
