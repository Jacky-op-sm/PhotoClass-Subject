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
    <section class="ruled" id="photos"><div class="section-head"><h2>Photos <small>${photos.length} / ${StudyPhotos.MAX_PHOTOS}</small></h2>
    <div class="photo-actions"><button id="add-photos" class="btn" type="button">Add photos</button><button id="add-topic-photos" class="text-btn" type="button">Add a topic folder</button></div></div>
    ${StudyPhotos.controls()}
    ${
      PhotoFolder.status().writable
        ? `<label class="topic-folder">Topic folder <input id="photo-topic" list="photo-topics" value="${esc(topicDraft)}" placeholder="Use source folder" autocomplete="off"></label>
    <datalist id="photo-topics"></datalist><p class="muted">Leave blank to keep a source subfolder. Files from outside the library go under this assignment’s title.</p>`
        : ''
    }
    <p id="photo-status" role="status"></p><progress id="add-progress" aria-label="Saving photos" max="1" value="${addFraction}" ${addingPhotos ? '' : 'hidden'}></progress>
    <div class="photo-grid">${photos
      .map(
        ([
          id,
          f,
        ]) => `<figure><button type="button" class="thumb photo-preview" data-light="${esc(id)}" aria-label="Open ${esc(f.caption || 'assignment photo')}"></button><figcaption>
      ${f.storage === 'folder' ? `<small>${esc(f.folders.join(' / '))}</small>` : ''}
      <label>Taken on<input type="date" data-date="${esc(id)}" value="${esc(f.takenOn)}"></label>
      <label>Caption<input maxlength="140" data-caption="${esc(id)}" value="${esc(f.caption)}"></label>
      <button class="text-btn" type="button" data-delete="${esc(id)}" ${f.storage === 'folder' && (!PhotoFolder.status().writable || f.libraryId !== PhotoFolder.status().id) ? 'disabled' : ''}>${f.storage === 'folder' ? 'Delete photo' : 'Remove reference'}</button></figcaption></figure>`
      )
      .join('')}</div></section>
    <dialog id="lightbox"><button class="btn" id="close-light">Close</button><div id="full-photo"></div><p id="light-caption"></p></dialog>`;
  Q('#assignment-status').onchange = (e) => {
    setAssignmentStatus(a.id, e.target.value);
    notice('Assignment status saved.');
  };
  StudyPhotos.bindControls(assignment);
  const folderState = PhotoFolder.status(),
    add = Q('#add-photos');
  add.disabled =
    addingPhotos ||
    !folderState.writable ||
    photos.length >= StudyPhotos.MAX_PHOTOS;
  if (photos.length >= StudyPhotos.MAX_PHOTOS)
    Q('#photo-status').textContent =
      'This assignment has reached its photo limit.';
  const addTopic = Q('#add-topic-photos');
  addTopic.disabled = add.disabled;
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
      Q('#add-progress').hidden = true;
      Q('#add-topic-photos').disabled = Q('#add-photos').disabled =
        !PhotoFolder.status().writable ||
        photosFor(getProgress(), a.id).length >= StudyPhotos.MAX_PHOTOS;
    }
  }
  add.onclick = () => addSelection(false);
  addTopic.onclick = () => addSelection(true);
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
      const isLocal =
        assignmentState(getProgress(), a.id).photos[button.dataset.delete]
          ?.storage === 'folder';
      if (
        !confirm(
          isLocal
            ? 'Delete the saved photo and thumbnail from your photo folder? Your original stays in place.'
            : 'Remove this photo reference from the assignment?'
        )
      )
        return;
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
  for (const [id, f] of photos) {
    const btn = QA('[data-light]').find((b) => b.dataset.light === id);
    StudyPhotos.showImage(btn, f, id, 'thumb', f.caption || a.title);
    btn.onclick = () => {
      const host = Q('#full-photo');
      host.textContent = 'Opening photo…';
      Q('#light-caption').textContent = f.caption;
      dialog.showModal();
      StudyPhotos.showImage(host, f, id, 'display', f.caption || a.title);
    };
  }
  StudyPhotos.pruneImages();
  dialog.onclose = () => StudyPhotos.clearImage(Q('#full-photo', dialog));
  Q('#close-light').onclick = () => dialog.close();
  dialog.onclick = (e) => {
    if (e.target === dialog) dialog.close();
  };
}
startPage(assignment);
