let addingPhotos = false;
let topicDraft = '';
let addFraction = 0;
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
  await StudyPhotos.ready;
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
  const folderState = PhotoFolder.status(),
    writable = folderState.writable,
    canAdd =
      writable && !addingPhotos && photos.length < StudyPhotos.MAX_PHOTOS;
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
    <section class="ruled" id="photos"><div class="section-head"><h2>Photos${photos.length ? ` <small>${photos.length}</small>` : ''}</h2>
    ${
      writable
        ? `<div class="photo-actions"><button id="add-photos" class="text-btn" type="button" ${canAdd ? '' : 'disabled'}>Add photos</button><button id="add-topic-photos" class="text-btn" type="button" ${canAdd ? '' : 'disabled'}>Add folder</button></div>`
        : ''
    }</div>
    ${StudyPhotos.controls()}
    <p id="photo-status" role="status"></p><progress id="add-progress" aria-label="Saving photos" max="1" value="${addFraction}" ${addingPhotos ? '' : 'hidden'}></progress>
    ${
      photos.length
        ? `<div class="photo-grid">${photos
            .map(
              ([id, f]) =>
                `<figure><button type="button" class="photo-preview" data-light="${esc(id)}" aria-label="Open ${esc(f.caption || 'photo')}"></button>${f.caption ? `<figcaption>${esc(f.caption)}</figcaption>` : ''}</figure>`
            )
            .join('')}</div>`
        : writable
          ? '<p class="muted">No photos yet.</p>'
          : ''
    }
    ${
      writable
        ? `<details class="photo-settings"${topicDraft ? ' open' : ''}><summary>Folder settings</summary>
    <p>Saved in <strong>${esc(folderState.name)}</strong> <button class="text-btn" type="button" data-folder-action="choose">Change folder</button></p>
    <label>Save new photos into <input id="photo-topic" list="photo-topics" value="${esc(topicDraft)}" placeholder="Same subfolder as the originals" autocomplete="off"></label><datalist id="photo-topics"></datalist>
    <p class="muted">Leave empty: photos already inside ${esc(folderState.name)} stay in their subfolder, and others go into “${esc(a.title)}”.</p></details>`
        : ''
    }</section>
    <dialog id="lightbox" aria-label="Photo"><div id="full-photo" tabindex="-1" autofocus></div>
    <div class="light-meta"><input id="light-caption" maxlength="140" placeholder="Add a caption" aria-label="Caption" autocomplete="off"><input id="light-date" type="date" aria-label="Taken on"><span id="light-folder"></span><button class="text-btn destructive" id="light-delete" type="button">Delete</button><button class="text-btn" id="close-light" type="button">Close</button></div></dialog>`;
  Q('#assignment-status').onchange = (e) => {
    setAssignmentStatus(a.id, e.target.value);
    notice('Assignment status saved.');
  };
  StudyPhotos.bindControls(assignment);
  const add = Q('#add-photos'),
    addTopic = Q('#add-topic-photos');
  if (photos.length >= StudyPhotos.MAX_PHOTOS)
    Q('#photo-status').textContent =
      'This assignment has reached its 12-photo limit.';
  const topic = Q('#photo-topic');
  if (topic) {
    topic.oninput = () => {
      topicDraft = topic.value;
    };
    const options = Q('#photo-topics');
    PhotoFolder.topics()
      .then((existing) => {
        const names = new Set([
          ...existing,
          ...sortedSubjects(p).map(([, s]) => s.text),
          ...a.topics,
        ]);
        options.replaceChildren(
          ...Array.from(names, (name) => new Option(name))
        );
      })
      .catch(handleError);
  }
  async function addSelection(wholeTopic) {
    if (addingPhotos) return;
    addingPhotos = true;
    add.disabled = addTopic.disabled = true;
    addFraction = 0;
    try {
      const result = await StudyPhotos.addPhotos(
        a,
        topic?.value || '',
        (fraction) => {
          addFraction = fraction;
          const bar = Q('#add-progress');
          if (bar) {
            bar.hidden = false;
            bar.value = fraction;
          }
        },
        wholeTopic
      );
      const message = result.failures.length
        ? result.failures.join(' · ')
        : 'Photos saved to your folder.';
      await assignment();
      Q('#photo-status').textContent = message;
      notice(message);
    } catch (e) {
      if (e.name !== 'AbortError') {
        Q('#photo-status').textContent = e.message;
        handleError(e);
      }
    } finally {
      addingPhotos = false;
      const bar = Q('#add-progress');
      if (bar) bar.hidden = true;
      const full =
        !PhotoFolder.status().writable ||
        photosFor(getProgress(), a.id).length >= StudyPhotos.MAX_PHOTOS;
      for (const button of QA('#add-photos, #add-topic-photos'))
        button.disabled = full;
    }
  }
  if (add) add.onclick = () => addSelection(false);
  if (addTopic) addTopic.onclick = () => addSelection(true);

  // Photo details live in the viewer, so the grid shows only the photos.
  const dialog = Q('#lightbox'),
    caption = Q('#light-caption'),
    taken = Q('#light-date'),
    remove = Q('#light-delete'),
    ids = photos.map(([id]) => id);
  let openId = null;
  const stored = (id) => assignmentState(getProgress(), a.id).photos[id];
  const thumbFor = (id) =>
    QA('[data-light]').find((b) => b.dataset.light === id);
  function showCaption(id, text) {
    const figure = thumbFor(id)?.closest('figure');
    if (!figure) return;
    let cap = Q('figcaption', figure);
    if (!text) return cap?.remove();
    if (!cap) cap = figure.appendChild(document.createElement('figcaption'));
    cap.textContent = text;
  }
  function commitDetails() {
    const f = openId && stored(openId);
    if (!f || f.deleted) return;
    const changes = {};
    if (caption.value !== (f.caption || '')) changes.caption = caption.value;
    if (taken.value && taken.value !== f.takenOn) changes.takenOn = taken.value;
    if (!Object.keys(changes).length) return;
    try {
      StudyPhotos.updatePhoto(a.id, openId, changes);
      if ('caption' in changes) showCaption(openId, changes.caption);
      notice('Photo details saved.');
    } catch (error) {
      handleError(error);
    }
  }
  function openPhoto(id) {
    commitDetails();
    const f = stored(id),
      s = PhotoFolder.status();
    if (!f) return;
    openId = id;
    const host = Q('#full-photo');
    host.textContent = 'Opening photo…';
    caption.value = f.caption || '';
    taken.value = f.takenOn || '';
    Q('#light-folder').textContent =
      f.storage === 'folder' ? f.folders.join(' / ') : '';
    remove.hidden =
      f.storage === 'folder' && (!s.writable || f.libraryId !== s.id);
    remove.textContent = f.storage === 'folder' ? 'Delete' : 'Remove';
    remove.disabled = false;
    if (!dialog.open) dialog.showModal();
    StudyPhotos.showImage(host, f, id, 'display', f.caption || a.title);
  }
  for (const [id, f] of photos) {
    const btn = thumbFor(id);
    StudyPhotos.showImage(btn, f, id, 'thumb', f.caption || a.title);
    btn.onclick = () => openPhoto(id);
  }
  StudyPhotos.pruneImages();
  caption.onchange = taken.onchange = commitDetails;
  remove.onclick = async () => {
    const id = openId,
      isLocal = stored(id)?.storage === 'folder';
    if (
      !confirm(
        isLocal
          ? 'Delete this photo from your photo folder? Your original stays in place.'
          : 'Remove this photo from the assignment?'
      )
    )
      return;
    remove.disabled = true;
    try {
      await StudyPhotos.deletePhoto(a.id, id);
      openId = null;
      dialog.close();
      await assignment();
      notice('Photo deleted.');
    } catch (error) {
      remove.disabled = false;
      handleError(error);
    }
  };
  dialog.onkeydown = (e) => {
    if (e.target.matches('input') || !openId) return;
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step) return;
    const next = ids[(ids.indexOf(openId) + step + ids.length) % ids.length];
    if (next !== openId) openPhoto(next);
  };
  dialog.onclose = () => {
    commitDetails();
    openId = null;
    StudyPhotos.clearImage(Q('#full-photo', dialog));
  };
  Q('#close-light').onclick = () => dialog.close();
  dialog.onclick = (e) => {
    if (e.target === dialog) dialog.close();
  };
}
startPage(assignment);
