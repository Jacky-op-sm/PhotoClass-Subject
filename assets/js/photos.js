/* Photo derivatives and their Storage records. The original File never leaves the decoder. */
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
  const UPLOAD_LIMIT = 2;
  const RETRIES = 1;
  const JOURNAL_PREFIX = 'photoclass-subject-pending-photo-v1-';
  const waiting = [];
  const activeIds = new Set();
  const reservedSlots = new Map();
  let running = 0;

  function syncCode() {
    return window.PhotoClassSync?.getSyncCode?.() || '';
  }

  function availability() {
    const config = window.PHOTOCLASS_FIREBASE_CONFIG;
    const sync = window.PhotoClassSync?.getStatus?.();
    let reason = '';
    if (!config?.apiKey || !config?.projectId) {
      reason = 'Set up Firebase to upload photos.';
    } else if (!config.storageBucket) {
      reason = 'Photo uploads require a Firebase Storage bucket on the Blaze plan.';
    } else if (!syncCode()) {
      reason = 'Enter your sync code in Sync settings to upload photos.';
    } else if (!navigator.onLine) {
      reason = 'Connect to the internet to upload photos.';
    } else if (!window.firebase?.storage) {
      reason = 'Firebase Storage could not load. Reload to try again.';
    } else if (!window.PhotoClassSync?.admitPhoto || !window.PhotoClassSync?.getCloudPhoto) {
      reason = 'Reload the page to enable cloud photo uploads.';
    } else if (!sync?.authorized) {
      reason = sync?.state === 'error' ? sync.message : 'Waiting for the sync profile to connect.';
    }
    return { enabled: !reason, reason };
  }

  function context() {
    const { enabled, reason } = availability();
    if (!enabled) throw new Error(reason);
    const code = syncCode();
    if (!/^[A-Za-z0-9_-]+$/.test(code)) throw new Error('Check the sync code in Sync settings.');
    const sdk = window.firebase;
    const app = sdk.apps.find(item => item.name === '[DEFAULT]') ||
      sdk.initializeApp(window.PHOTOCLASS_FIREBASE_CONFIG);
    return { code, storage: app.storage() };
  }

  function checkId(id) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new Error('The photo or assignment ID is invalid.');
    }
  }

  function makeId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)),
      value => value.toString(16).padStart(2, '0')).join('');
  }

  function today() {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth()+1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')].join('-');
  }

  async function decode(file) {
    if (window.createImageBitmap) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
      } catch { /* The native image element can decode additional formats on Safari. */ }
    }
    const source = new Image();
    const url = URL.createObjectURL(file);
    try {
      source.src = url;
      await source.decode();
      return { source, width: source.naturalWidth, height: source.naturalHeight,
        close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error('This image could not be decoded. Export as JPEG and try again.');
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
      if (!ctx) throw new Error('The image is too large for this browser. Export as JPEG and try again.');
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
      canvas.toBlob(blob => {
        if (blob?.type === 'image/jpeg') resolve(blob);
        else reject(new Error('JPEG encoding failed. Export as JPEG and try again.'));
      }, 'image/jpeg', quality);
    });
  }

  async function stripMetadata(blob) {
    // WebKit can add a fresh EXIF segment during canvas export. Keep color profiles and image data.
    const data = new Uint8Array(await blob.arrayBuffer());
    const pieces = [];
    let kept = 0, pos = 2;
    while (pos < data.length && data[pos] === 0xff) {
      const start = pos;
      while (data[pos] === 0xff) pos++;
      const marker = data[pos++];
      if (marker === 0xda || marker === 0xd9) break; // Start of scan or end of image.
      const length = (data[pos] << 8) + data[pos + 1];
      if (length < 2 || pos + length > data.length) throw new Error('Invalid JPEG encoder output.');
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
        const edge = Math.max(1, Math.floor(Math.max(result.width, result.height) * ratio));
        const smaller = scale(result, result.width, result.height, edge);
        if (result !== canvas) result.width = result.height = 0;
        result = smaller;
        blob = await jpeg(result, qualities[qualities.length - 1]);
      }
      return { blob: await stripMetadata(blob), w: result.width, h: result.height };
    } finally {
      if (result !== canvas) result.width = result.height = 0;
    }
  }

  async function prepare(file) {
    if (!(file instanceof Blob) || !file.size) throw new Error('Choose an image file.');
    if (file.size > MAX_INPUT_BYTES) throw new Error('Choose an image smaller than 50 MB.');
    const decoded = await decode(file);
    let displayCanvas, thumbCanvas;
    try {
      displayCanvas = scale(decoded.source, decoded.width, decoded.height, DISPLAY_EDGE);
      thumbCanvas = scale(displayCanvas, displayCanvas.width, displayCanvas.height, THUMB_EDGE);
      const display = await encode(displayCanvas, DISPLAY_QUALITIES, DISPLAY_MAX_BYTES);
      const thumb = await encode(thumbCanvas, [THUMB_QUALITY], THUMB_TARGET_BYTES);
      return { display, thumb };
    } finally {
      decoded.close();
      if (displayCanvas) displayCanvas.width = displayCanvas.height = 0;
      if (thumbCanvas) thumbCanvas.width = thumbCanvas.height = 0;
    }
  }

  function livePhotos(assignment) {
    return Object.values(assignment?.photos || {}).filter(photo => !photo.deleted);
  }

  function recordPhoto(assignmentId, photoId, transform) {
    const data = window.getProgress();
    const records = data.playbook.assignments;
    const now = new Date().toISOString();
    const assignment = records[assignmentId] || (records[assignmentId] = {
      status: 'todo', statusAt: now, currentSince: null, doneAt: null, updatedAt: now, photos: {},
    });
    assignment.photos ||= {};
    assignment.photos[photoId] = transform(assignment.photos[photoId], assignment, now);
    assignment.updatedAt = now;
    if (!window.saveProgress(data)) throw new Error('Could not save the photo record in this browser.');
  }

  function refs(ctx, assignmentId, photoId) {
    const base = 'subject/' + ctx.code + '/photos/' + assignmentId + '/' + photoId;
    return { display: ctx.storage.ref(base + '-d.jpg'), thumb: ctx.storage.ref(base + '-t.jpg') };
  }

  function describe(error) {
    if (['storage/unauthorized', 'storage/unauthenticated'].includes(error?.code)) {
      return 'Storage denied access. Check your sync code and Firebase rules.';
    }
    if (error?.code === 'storage/quota-exceeded') return 'The Storage quota has been reached.';
    if (error?.code === 'storage/retry-limit-exceeded') return 'The upload timed out. Check your connection and try again.';
    if (error?.code?.startsWith('storage/')) return 'Storage could not complete the request. Try again.';
    return error?.message || 'The photo could not be saved.';
  }

  async function removeObjects(pair) {
    const results = await Promise.allSettled(Object.values(pair).map(async ref => {
      try { await ref.delete(); }
      catch (error) { if (error.code !== 'storage/object-not-found') throw error; }
    }));
    const failure = results.find(r => r.status === 'rejected');
    if (failure) throw failure.reason;
  }

  async function put(ref, blob, report) {
    const metadata = { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' };
    let previousError;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      if (attempt) {
        // The server may have committed the immutable object before its response was lost.
        try {
          const meta = await ref.getMetadata();
          if (meta.size === blob.size && meta.contentType === 'image/jpeg') {
            const url = await ref.getDownloadURL();
            report(blob.size);
            return url;
          }
        } catch { /* Retry the write or surface its final error. */ }
      }
      try {
        const task = ref.put(blob, metadata);
        const off = task.on('state_changed', snap => report(snap.bytesTransferred));
        try { await task; }
        finally { off(); }
        const url = await ref.getDownloadURL();
        report(blob.size);
        return url;
      } catch (error) {
        previousError = error;
      }
    }
    throw previousError;
  }

  function withLock(name, action, options = {}) {
    if (!navigator.locks) return action(true);
    return navigator.locks.request('photoclass-subject-' + name, options, action);
  }

  async function fingerprint(code) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
  }

  function finishJournal(id) {
    try { localStorage.removeItem(JOURNAL_PREFIX + id); } catch { /* Recovery is idempotent. */ }
  }

  async function recover(ctx, signature) {
    for (const key of Object.keys(localStorage).filter(k => k.startsWith(JOURNAL_PREFIX))) {
      const id = key.slice(JOURNAL_PREFIX.length);
      if (activeIds.has(id)) continue;
      await withLock('photo-' + id, async lock => {
        if (!lock || activeIds.has(id)) return;
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const pending = JSON.parse(raw);
        if (pending.signature !== signature) return;
        checkId(id);
        checkId(pending.assignmentId);
        // Older engines without Web Locks may share storage with a second active tab.
        if (!navigator.locks && Date.now() - pending.started < 30 * 60_000) return;
        if (pending.stage === 'admitting') {
          // The last tab may have lost the transaction acknowledgement after the server committed.
          const cloud = await window.PhotoClassSync.getCloudPhoto(pending.assignmentId, id);
          if (ctx.code !== syncCode()) return;
          if (cloud && !cloud.deleted) {
            await withLock('photo-records', () => {
              recordPhoto(pending.assignmentId, id, local =>
                local && local.updatedAt > cloud.updatedAt ? local : cloud);
            });
            finishJournal(id);
            return;
          }
        } else {
          const local = window.getProgress().playbook.assignments[pending.assignmentId]?.photos?.[id];
          if (local && !local.deleted) { finishJournal(id); return; }
        }
        await removeObjects(refs(ctx, pending.assignmentId, id));
        finishJournal(id);
      }, { ifAvailable: true });
    }
  }

  let recovering = false;
  async function recoverWhenConnected() {
    if (recovering || !availability().enabled) return;
    recovering = true;
    try {
      if (!Object.keys(localStorage).some(key => key.startsWith(JOURNAL_PREFIX))) return;
      const ctx = context();
      await recover(ctx, await fingerprint(ctx.code));
    } catch { /* A pending operation remains journaled for the next connection or upload. */ }
    finally { recovering = false; }
  }
  window.addEventListener('photoclass-sync-status', recoverWhenConnected);
  window.addEventListener('online', recoverWhenConnected);
  queueMicrotask(recoverWhenConnected);

  function checkSession(ctx) {
    if (syncCode() !== ctx.code) throw new Error('The sync profile changed during this upload.');
    const { enabled, reason } = availability();
    if (!enabled) throw new Error(reason);
  }

  async function uploadOne(file, assignmentId, ctx, signature, report) {
    checkSession(ctx);
    const { display, thumb } = await prepare(file);
    const bytes = display.blob.size + thumb.blob.size;
    const id = makeId();
    const pair = refs(ctx, assignmentId, id);
    activeIds.add(id);
    try {
      return await withLock('photo-' + id, async () => {
        checkSession(ctx);
        const journal = { assignmentId, signature, started: Date.now(), stage: 'transferring' };
        localStorage.setItem(JOURNAL_PREFIX + id, JSON.stringify(journal));
        let admitting = false;
        try {
          const displayUrl = await put(pair.display, display.blob, n => report(n / bytes));
          checkSession(ctx);
          const thumbUrl = await put(pair.thumb, thumb.blob, n => report((n + display.blob.size) / bytes));
          checkSession(ctx);
          const now = new Date().toISOString();
          const record = { takenOn: today(), caption: '', w: display.w, h: display.h, bytes,
            displayPath: pair.display.fullPath, thumbPath: pair.thumb.fullPath, displayUrl, thumbUrl,
            createdAt: now, updatedAt: now, deleted: false };
          // Journal the candidate locally. Ordinary progress sync sees it only after atomic admission.
          localStorage.setItem(JOURNAL_PREFIX + id, JSON.stringify({ ...journal, stage: 'admitting', record }));
          admitting = true;
          await window.PhotoClassSync.admitPhoto(assignmentId, id, record, MAX_PHOTOS);
        } catch (error) {
          if (admitting && error.code !== 'photo-limit' && !error.photoRejected) {
            throw new Error('Photo confirmation was interrupted. Reconnect to finish checking this upload.');
          }
          const reason = error.code === 'photo-limit' ? 'This assignment already has 12 photos.' : describe(error);
          try { await removeObjects(pair); finishJournal(id); }
          catch {
            throw new Error(reason + ' Cleanup will be retried when this profile reconnects.');
          }
          throw new Error(reason);
        }
        finishJournal(id);
        report(1);
        return id;
      });
    } finally {
      activeIds.delete(id);
    }
  }

  function runQueued(action) {
    return new Promise((resolve, reject) => {
      const begin = () => {
        running++;
        action().then(resolve, reject).finally(() => {
          running--;
          waiting.shift()?.();
        });
      };
      if (running < UPLOAD_LIMIT) begin();
      else waiting.push(begin);
    });
  }

  async function uploadFiles(assignmentId, selection, { onProgress, onPhoto } = {}) {
    checkId(assignmentId);
    const ctx = context();
    const files = Array.from(selection || []);
    if (!files.length) return { uploaded: [], failed: [] };
    const used = livePhotos(window.getProgress().playbook.assignments[assignmentId]).length;
    const reserved = reservedSlots.get(assignmentId) || 0;
    if (used + reserved + files.length > MAX_PHOTOS) throw new Error('Each assignment can hold up to 12 photos.');
    reservedSlots.set(assignmentId, reserved + files.length);
    let remaining = files.length;
    function release(count) {
      remaining -= count;
      const pending = (reservedSlots.get(assignmentId) || 0) - count;
      if (pending) reservedSlots.set(assignmentId, pending);
      else reservedSlots.delete(assignmentId);
    }
    const fractions = files.map(() => 0);
    const uploaded = [], failed = [];
    try {
      const signature = await fingerprint(ctx.code);
      await recover(ctx, signature);
      await Promise.all(files.map((file, i) => runQueued(async () => {
        try {
          const id = await uploadOne(file, assignmentId, ctx, signature, n => {
            fractions[i] = Math.max(fractions[i], n);
            onProgress?.(fractions.reduce((a, b) => a + b, 0) / files.length);
          });
          uploaded.push(id);
          onPhoto?.(id);
        } catch (error) {
          failed.push({ name: file.name || 'Image', error: describe(error) });
        } finally {
          release(1);
        }
      })));
    } finally {
      if (remaining) release(remaining);
    }
    return { uploaded, failed };
  }

  function updatePhoto(assignmentId, id, changes) {
    checkId(assignmentId);
    checkId(id);
    recordPhoto(assignmentId, id, (photo, _, now) => {
      if (!photo || photo.deleted) throw new Error('This photo is no longer available.');
      const caption = changes.caption ?? photo.caption ?? '';
      const takenOn = changes.takenOn ?? photo.takenOn;
      if (typeof caption !== 'string' || Array.from(caption).length > 140) throw new Error('Use a caption of 140 characters or fewer.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(takenOn) || !Number.isFinite(Date.parse(takenOn)) ||
          new Date(takenOn).toISOString().slice(0, 10) !== takenOn) throw new Error('Choose a valid date.');
      return { ...photo, takenOn, caption, updatedAt: now };
    });
  }

  async function deletePhoto(assignmentId, id) {
    checkId(assignmentId);
    checkId(id);
    const ctx = context();
    const photo = window.getProgress().playbook.assignments[assignmentId]?.photos?.[id];
    if (!photo || photo.deleted) return;
    const pair = refs(ctx, assignmentId, id);
    if (photo.displayPath !== pair.display.fullPath || photo.thumbPath !== pair.thumb.fullPath) {
      throw new Error('Use the sync profile that owns this photo.');
    }
    try { await removeObjects(pair); }
    catch (error) { throw new Error(describe(error) + ' The photo record was kept. Retry deletion.'); }
    await withLock('photo-records', () => {
      if (syncCode() !== ctx.code) throw new Error('The sync profile changed. Switch back to finish deletion.');
      recordPhoto(assignmentId, id, (current, _, now) => ({
        ...(current || photo), updatedAt: now, deleted: true,
      }));
    });
  }

  window.StudyPhotos = Object.freeze({ MAX_PHOTOS, availability, prepare, uploadFiles, updatePhoto, deletePhoto });
})();
