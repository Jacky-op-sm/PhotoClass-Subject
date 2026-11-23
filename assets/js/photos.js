/* JPEG copies for the folder selected by the photographer. */
(() => {
  'use strict';

  const MAX_PHOTOS = 12;
  const MAX_INPUT_BYTES = 50 * 1024 * 1024;
  const DISPLAY_EDGE = 1600;
  const DISPLAY_QUALITIES = [0.8, 0.7, 0.6];
  const DISPLAY_MAX_BYTES = 450 * 1024;
  const THUMB_EDGE = 480;
  const THUMB_QUALITY = 0.72;
  const THUMB_TARGET_BYTES = 60 * 1024;
  async function decode(file) {
    if (window.createImageBitmap) {
      try {
        const bitmap = await createImageBitmap(file, {
          imageOrientation: 'from-image',
        });
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          close: () => bitmap.close(),
        };
      } catch {
        /* The native image element can decode additional formats on Safari. */
      }
    }
    const source = new Image();
    const url = URL.createObjectURL(file);
    try {
      source.src = url;
      await source.decode();
      return {
        source,
        width: source.naturalWidth,
        height: source.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error(
        'This image could not be decoded. Export as JPEG and try again.'
      );
    }
  }

  function scale(source, width, height, edge) {
    let current = source;
    let w = width;
    let h = height;
    do {
      const ratio = Math.min(1, Math.max(0.5, edge / Math.max(w, h)));
      w = Math.max(1, Math.round(w * ratio));
      h = Math.max(1, Math.round(h * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx)
        throw new Error(
          'The image is too large for this browser. Export as JPEG and try again.'
        );
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(current, 0, 0, w, h);
      if (current !== source) current.width = current.height = 0;
      current = canvas;
    } while (Math.max(w, h) > edge);
    return current;
  }

  function jpeg(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob?.type === 'image/jpeg') resolve(blob);
          else
            reject(
              new Error('JPEG encoding failed. Export as JPEG and try again.')
            );
        },
        'image/jpeg',
        quality
      );
    });
  }

  async function stripMetadata(blob) {
    // WebKit can add a fresh EXIF segment during canvas export. Keep color profiles and image data.
    const data = new Uint8Array(await blob.arrayBuffer());
    const pieces = [];
    let kept = 0,
      pos = 2;
    while (pos < data.length && data[pos] === 0xff) {
      const start = pos;
      while (data[pos] === 0xff) pos++;
      const marker = data[pos++];
      if (marker === 0xda || marker === 0xd9) break; // Start of scan or end of image.
      const length = (data[pos] << 8) + data[pos + 1];
      if (length < 2 || pos + length > data.length)
        throw new Error('Invalid JPEG encoder output.');
      pos += length;
      if (marker === 0xe1 || marker === 0xed || marker === 0xfe) {
        pieces.push(blob.slice(kept, start));
        kept = pos;
      }
    }
    if (!pieces.length) return blob;
    pieces.push(blob.slice(kept));
    return new Blob(pieces, { type: 'image/jpeg' });
  }

  async function encode(canvas, qualities, limit) {
    let result = canvas;
    try {
      let blob;
      for (const quality of qualities) {
        blob = await jpeg(result, quality);
        if (blob.size <= limit) break;
      }
      // Dense images can exceed the ceiling at the lowest quality. Keep their aspect ratio.
      while (blob.size > limit) {
        const ratio = Math.min(0.9, Math.sqrt(limit / blob.size) * 0.95);
        const edge = Math.max(
          1,
          Math.floor(Math.max(result.width, result.height) * ratio)
        );
        const smaller = scale(result, result.width, result.height, edge);
        if (result !== canvas) result.width = result.height = 0;
        result = smaller;
        blob = await jpeg(result, qualities[qualities.length - 1]);
      }
      return {
        blob: await stripMetadata(blob),
        w: result.width,
        h: result.height,
      };
    } finally {
      if (result !== canvas) result.width = result.height = 0;
    }
  }

  async function prepare(file) {
    if (!(file instanceof Blob) || !file.size)
      throw new Error('Choose an image file.');
    if (file.size > MAX_INPUT_BYTES)
      throw new Error('Choose an image smaller than 50 MB.');
    const decoded = await decode(file);
    let displayCanvas, thumbCanvas;
    try {
      displayCanvas = scale(
        decoded.source,
        decoded.width,
        decoded.height,
        DISPLAY_EDGE
      );
      thumbCanvas = scale(
        displayCanvas,
        displayCanvas.width,
        displayCanvas.height,
        THUMB_EDGE
      );
      const display = await encode(
        displayCanvas,
        DISPLAY_QUALITIES,
        DISPLAY_MAX_BYTES
      );
      const thumb = await encode(
        thumbCanvas,
        [THUMB_QUALITY],
        THUMB_TARGET_BYTES
      );
      return { display, thumb };
    } finally {
      decoded.close();
      if (displayCanvas) displayCanvas.width = displayCanvas.height = 0;
      if (thumbCanvas) thumbCanvas.width = thumbCanvas.height = 0;
    }
  }

  function recordPhoto(assignmentId, photoId, transform) {
    const data = window.getProgress();
    const records = data.playbook.assignments;
    const now = new Date().toISOString();
    const assignment =
      records[assignmentId] ||
      (records[assignmentId] = {
        status: 'todo',
        statusAt: now,
        currentSince: null,
        doneAt: null,
        updatedAt: now,
        photos: {},
      });
    assignment.photos ||= {};
    assignment.photos[photoId] = transform(
      assignment.photos[photoId],
      assignment,
      now
    );
    assignment.updatedAt = now;
    if (!window.saveProgress(data))
      throw new Error('Could not save the photo record in this browser.');
  }

  function updatePhoto(assignmentId, id, changes) {
    recordPhoto(assignmentId, id, (photo, _, now) => {
      if (!photo || photo.deleted)
        throw new Error('This photo is no longer available.');
      const caption = changes.caption ?? photo.caption ?? '';
      const takenOn = changes.takenOn ?? photo.takenOn;
      if (typeof caption !== 'string' || Array.from(caption).length > 140)
        throw new Error('Use a caption of 140 characters or fewer.');
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(takenOn) ||
        !Number.isFinite(Date.parse(takenOn)) ||
        new Date(takenOn).toISOString().slice(0, 10) !== takenOn
      )
        throw new Error('Choose a valid date.');
      return { ...photo, takenOn, caption, updatedAt: now };
    });
  }

  const folder = window.PhotoFolder;
  const journalPrefix = 'photoclass-subject-folder-operation-v1-';
  const lockName = 'photoclass-subject-local-photos';
  const images = new Map();
  const imageRequests = new WeakMap();

  function safeName(text, fallback) {
    const clean = String(text || '')
      .normalize('NFC')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
      .replace(/^[.\s]+|[.\s]+$/g, '');
    return [...clean].slice(0, 48).join('') || fallback;
  }
  function typedFolders(text) {
    const parts = text
      .trim()
      .split('/')
      .map((s) => s.trim());
    if (!parts.every(validFolderPart))
      throw Error('Enter a relative topic folder name, such as Street/Rain.');
    return parts;
  }
  async function foldersFor(root, source, chosen, title) {
    if (chosen.trim()) return typedFolders(chosen);
    const relative = await root.resolve(source);
    const parts = relative?.slice(0, -1);
    if (parts?.length && parts.every(validFolderPart)) return parts;
    return [safeName(title, 'Assignments')];
  }
  async function recover(selected) {
    await folder.verify(selected);
    for (const key of Object.keys(localStorage).filter((k) =>
      k.startsWith(journalPrefix)
    )) {
      const id = key.slice(journalPrefix.length);
      const op = JSON.parse(localStorage.getItem(key));
      if (!op || op.photo.libraryId !== selected.id) continue;
      const stored =
        getProgress().playbook.assignments[op.assignment]?.photos?.[id];
      if (op.action === 'delete' || !stored || stored.deleted) {
        await folder.remove(selected, op.photo, id);
        if (op.action === 'delete' && stored && !stored.deleted) {
          recordPhoto(op.assignment, id, (current, _, now) => ({
            ...current,
            deleted: true,
            updatedAt: now,
          }));
        }
      }
      localStorage.removeItem(key);
    }
  }
  async function recoverOnOpen() {
    if (
      folder.status().writable &&
      Object.keys(localStorage).some((k) => k.startsWith(journalPrefix))
    ) {
      await navigator.locks.request(lockName, () =>
        recover(folder.access(true))
      );
    }
  }
  const ready = folder.ready
    .then(recoverOnOpen)
    .catch((error) => notice(error.message));

  async function addPhotos(assignment, chosen, progress, wholeTopic = false) {
    const selected = folder.access(true);
    if (chosen.trim()) typedFolders(chosen);
    // Invoke the native picker during the click, before waiting on other I/O.
    let files,
      sourceTopic = '';
    if (wholeTopic) {
      const sourceDir = await window.showDirectoryPicker({
        id: 'photoclass-topic',
        mode: 'read',
        startIn: selected.root,
      });
      const relative = await selected.root.resolve(sourceDir);
      sourceTopic =
        relative?.length && relative.every(validFolderPart)
          ? relative.join('/')
          : safeName(sourceDir.name, 'Photos');
      files = [];
      for await (const source of sourceDir.values()) {
        if (
          source.kind === 'file' &&
          /\.(jpe?g|png|webp|heic|heif|avif|gif|tiff?)$/i.test(source.name) &&
          !/--pc-[0-9a-f]{32}\.jpg$/i.test(source.name) &&
          !source.name.startsWith('.')
        )
          files.push(source);
      }
      files.sort((a, b) => a.name.localeCompare(b.name));
      if (!files.length)
        throw Error('This topic folder has no image files to add.');
    } else {
      files = await window.showOpenFilePicker({
        id: 'photoclass-add',
        startIn: selected.root,
        multiple: true,
        types: [
          {
            description: 'Photos',
            accept: {
              'image/*': [
                '.jpg',
                '.jpeg',
                '.png',
                '.webp',
                '.heic',
                '.heif',
                '.avif',
                '.gif',
                '.tif',
                '.tiff',
              ],
            },
          },
        ],
      });
    }
    return navigator.locks.request(lockName, async () => {
      await recover(selected);
      const used = photosFor(getProgress(), assignment.id).length;
      if (used + files.length > MAX_PHOTOS)
        throw Error('Each assignment can hold up to 12 photos.');
      const failures = [];
      let saved = 0;
      progress(0);
      for (const [index, source] of files.entries()) {
        const id = crypto.randomUUID().replaceAll('-', '');
        const key = journalPrefix + id;
        try {
          const original = await source.getFile();
          const parts = await foldersFor(
            selected.root,
            source,
            chosen.trim() || sourceTopic,
            assignment.title
          );
          const { display, thumb } = await prepare(original);
          if (folder.access(true).id !== selected.id)
            throw Error('The photo folder changed. Try again.');
          const date = new Date().toISOString();
          const photo = {
            storage: 'folder',
            libraryId: selected.id,
            folders: parts,
            fileName:
              safeName(original.name.replace(/\.[^.]*$/, ''), 'Photo') +
              '--pc-' +
              id +
              '.jpg',
            caption: '',
            takenOn: localDay(),
            w: display.w,
            h: display.h,
            bytes: display.blob.size + thumb.blob.size,
            createdAt: date,
            updatedAt: date,
            deleted: false,
          };
          localStorage.setItem(
            key,
            JSON.stringify({ action: 'add', assignment: assignment.id, photo })
          );
          try {
            await folder.save(selected, photo, id, 'display', display.blob);
            await folder.save(selected, photo, id, 'thumb', thumb.blob);
            recordPhoto(assignment.id, id, (_, a) => {
              if (
                Object.values(a.photos).filter((f) => !f.deleted).length >=
                MAX_PHOTOS
              )
                throw Error('This assignment has reached its photo limit.');
              return photo;
            });
          } catch (e) {
            await folder.remove(selected, photo, id);
            localStorage.removeItem(key);
            throw e;
          }
          localStorage.removeItem(key);
          saved++;
        } catch (e) {
          failures.push(source.name + ' — ' + e.message);
        }
        progress((index + 1) / files.length);
      }
      return { saved, failures };
    });
  }
  async function deletePhoto(assignmentId, id) {
    const photo = assignmentState(getProgress(), assignmentId).photos[id];
    if (!photo || photo.deleted) return;
    function markDeleted() {
      recordPhoto(assignmentId, id, (p, _, now) => ({
        ...p,
        updatedAt: now,
        deleted: true,
      }));
    }
    if (photo.storage !== 'folder') {
      markDeleted();
      return;
    }
    const selected = folder.access(true);
    await navigator.locks.request(lockName, async () => {
      await folder.verify(selected);
      if (selected.id !== photo.libraryId)
        throw Error('Connect the folder that holds this photo.');
      const key = journalPrefix + id;
      localStorage.setItem(
        key,
        JSON.stringify({ action: 'delete', assignment: assignmentId, photo })
      );
      await folder.remove(selected, photo, id);
      markDeleted();
      localStorage.removeItem(key);
    });
  }

  function controls() {
    const s = folder.status();
    if (!s.supported)
      return '<p class="muted">Use desktop Chrome or Edge to connect your photo folder.</p>';
    return `<div class="folder-controls"><span>${s.name ? 'Photo folder · ' + esc(s.name) : 'Choose a local photo folder outside the website project.'}</span>
      ${s.name && !s.writable ? `<button class="btn" type="button" data-folder-action="reconnect">Reconnect folder</button>` : ''}
      <button class="text-btn" type="button" data-folder-action="choose">${s.name ? 'Change folder' : 'Choose photo folder'}</button>
      ${s.issue ? `<span>${esc(s.issue)}</span>` : ''}</div>`;
  }
  function bindControls(render) {
    for (const btn of QA('[data-folder-action]'))
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          if (btn.dataset.folderAction === 'choose') await folder.choose();
          else await folder.reconnect();
          await recoverOnOpen();
        } catch (error) {
          if (error.name !== 'AbortError') notice(error.message);
        } finally {
          btn.disabled = false;
          await render();
        }
      };
  }

  function pruneImages() {
    for (const [img, url] of images)
      if (!img.isConnected) {
        URL.revokeObjectURL(url);
        images.delete(img);
      }
  }
  async function showImage(host, photo, id, variant, alt) {
    const request = Symbol();
    imageRequests.set(host, request);
    const current = () =>
      host.isConnected && imageRequests.get(host) === request;
    const image = document.createElement('img');
    image.alt = alt;
    image.decoding = 'async';
    image.loading = variant === 'thumb' ? 'lazy' : 'eager';
    let url = '';
    try {
      if (photo.storage === 'folder') {
        const s = folder.status();
        if (!s.supported || (s.id && photo.libraryId !== s.id) || !s.id)
          throw Error('Photo on another computer or in another folder.');
        if (!s.readable)
          throw Error('Reconnect your photo folder to view this photo.');
        const blob = await folder.file(folder.access(), photo, id, variant);
        if (!current()) return;
        url = URL.createObjectURL(blob);
        images.set(image, url);
      } else {
        url = photoURL(
          variant === 'thumb' ? photo.thumbUrl : photo.displayUrl
        ).replaceAll('&amp;', '&');
        if (!url) throw Error('Photo unavailable.');
      }
      image.onerror = () => {
        if (host.contains(image)) host.textContent = 'Photo unavailable.';
        pruneImages();
      };
      image.src = url;
      host.replaceChildren(image);
    } catch (e) {
      if (current())
        host.textContent =
          e.name === 'NotFoundError'
            ? 'File missing from the connected folder.'
            : e.message;
    } finally {
      pruneImages();
    }
  }

  function clearImage(host) {
    imageRequests.delete(host);
    host.replaceChildren();
    pruneImages();
  }

  window.StudyPhotos = Object.freeze({
    MAX_PHOTOS,
    ready,
    prepare,
    controls,
    bindControls,
    addPhotos,
    updatePhoto,
    deletePhoto,
    showImage,
    clearImage,
    pruneImages,
  });
})();
