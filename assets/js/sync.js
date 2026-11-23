/* Firestore 10.12.5 compat. Local progress remains available during connection changes. */
(() => {
  'use strict';

  const prefix = 'photoclass-subject-';
  const codeKey = prefix + 'sync-code-v1';
  const lastKey = prefix + 'last-sync-v1';
  const deviceKey = prefix + 'device-label-v1';
  const keepDeletedFor = 90 * 24 * 60 * 60 * 1000;
  let connection = null;
  let stopListening;
  let timer;
  let retryTimer;
  let busy = false;
  let queued = false;
  let retryDelay = 1500;
  let authorized = false;
  let phase = 'local_only';
  let message = 'Local only';

  function read(key) {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
  }
  function getSyncCode() { return read(codeKey); }
  function configured() {
    const config = window.PHOTOCLASS_FIREBASE_CONFIG;
    return Boolean(config?.projectId && config?.apiKey && config?.appId && window.firebase?.firestore);
  }
  function getStatus() {
    return { state: phase, message, configured: configured(), enabled: Boolean(getSyncCode()),
      authorized, lastSyncedAt: read(lastKey) || null };
  }
  function status(state, text) {
    phase = state;
    message = text;
    window.dispatchEvent(new CustomEvent('photoclass-sync-status', {detail: getStatus()}));
  }
  function generateSyncCode() {
    return Array.from(crypto.getRandomValues(new Uint8Array(24)), n => n.toString(16).padStart(2, '0')).join('');
  }
  function device() {
    let label = read(deviceKey);
    if (!label) {
      label = 'browser-' + crypto.randomUUID();
      localStorage.setItem(deviceKey, label);
    }
    return label;
  }

  // Sorting keys makes timestamp ties and snapshot equality deterministic across devices.
  function stable(value) {
    return JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  }
  function later(a, b) { return (a || '') >= (b || '') ? a : b; }
  function newest(a, b, stamp) {
    if (!a || !b) return a || b;
    const at = stamp(a) || '', bt = stamp(b) || '';
    if (at !== bt) return at > bt ? a : b;
    if (Boolean(a.deleted) !== Boolean(b.deleted)) return a.deleted ? a : b;
    return stable(a) >= stable(b) ? a : b;
  }
  function entries(a, b, choose) {
    const out = [];
    for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
      const value = choose(Object.hasOwn(a || {}, k) ? a[k] : null, Object.hasOwn(b || {}, k) ? b[k] : null);
      if (value) out.push([k, value]);
    }
    return Object.fromEntries(out);
  }
  const entityTime = v => v.updatedAt;
  const statusTime = v => v.statusAt || v.updatedAt || '1970-01-01T00:00:00.000Z';

  function merge(a, b) {
    // A watermark prevents a browser returning after garbage collection from reviving old entries.
    let prunedThrough = later(a.prunedThrough, b.prunedThrough);
    const cutoff = new Date(Date.now() - keepDeletedFor).toISOString();
    function withTombstones(left, right) {
      if (!right && left && left.updatedAt <= (b.prunedThrough || '')) return null;
      if (!left && right && right.updatedAt <= (a.prunedThrough || '')) return null;
      const v = newest(left, right, entityTime);
      if (v?.deleted && v.updatedAt && v.updatedAt < cutoff) {
        prunedThrough = later(prunedThrough, v.updatedAt);
        return null;
      }
      return v;
    }
    const subjects = entries(a.subjects, b.subjects, withTombstones);
    const segments = entries(a.onbeing.segments, b.onbeing.segments, (x, y) => newest(x, y, entityTime));
    const assignments = entries(a.playbook.assignments, b.playbook.assignments, (x, y) => {
      // A photo edit can advance updatedAt without changing assignment status.
      function state(v) {
        if (!v) return null;
        return {status: v.status || 'todo', statusAt: statusTime(v),
          currentSince: v.currentSince || null, doneAt: v.doneAt || null};
      }
      const pick = newest(state(x), state(y), statusTime);
      return {...pick, updatedAt: later(x?.updatedAt, y?.updatedAt) || pick.statusAt,
        photos: entries(x?.photos, y?.photos, withTombstones)};
    });
    const current = Object.entries(assignments).filter(([,v]) => v.status === 'current')
      .sort(([ka,va], [kb,vb]) => {
        const ta = statusTime(va) || '', tb = statusTime(vb) || '';
        if (ta !== tb) return ta < tb ? 1 : -1;
        return ka < kb ? -1 : Number(ka > kb);
      });
    for (const [,v] of current.slice(1)) {
      v.status = 'todo';
      v.statusAt = current[0][1].statusAt;
      v.updatedAt = later(v.updatedAt, v.statusAt);
      v.currentSince = null;
      v.doneAt = null;
    }
    const startedAt = [a.startedAt, b.startedAt].filter(Boolean).sort()[0];
    const merged = {version: 1, startedAt, updatedAt: later(a.updatedAt, b.updatedAt) || startedAt + 'T00:00:00.000Z',
      onbeing: {segments}, playbook: {assignments}, subjects};
    if (prunedThrough) merged.prunedThrough = prunedThrough;
    return merged;
  }
  function usable(progress) {
    return window.validProgress(progress);
  }
  function cloudProgress(snapshot) {
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    if (data?.app !== 'photoclass-subject' || data.schemaVersion !== 1 || !usable(data.progress)) {
      throw Object.assign(new Error(), {code: 'unsupported-data'});
    }
    return data.progress;
  }
  function localProgress() {
    try { return window.getProgress(); }
    catch { throw Object.assign(new Error(), {code: 'invalid-local'}); }
  }
  function apply(progress) {
    const saved = localProgress();
    if (read(prefix + 'progress-v1') && stable(progress) === stable(saved)) return;
    if (!window.saveProgress(progress, {sync: false, touch: false})) {
      throw Object.assign(new Error(), {code: 'local-storage'});
    }
    window.dispatchEvent(new CustomEvent('photoclass-sync-progress-updated'));
  }
  function fail(error, session) {
    if (connection !== session) return;
    if (['permission-denied','unauthenticated','unsupported-data','invalid-local','local-storage','invalid-argument'].includes(error?.code)) {
      stopListening?.();
      connection = null;
      authorized = false;
      clearTimeout(timer);
      status('error', {'permission-denied':'Sync code or rules rejected access',
        'unauthenticated':'Sync code or rules rejected access', 'unsupported-data':'Cloud progress format is unsupported',
        'invalid-local':'Local progress could not be read. Restore a progress backup.',
        'invalid-argument':'Cloud save rejected. Check the progress document size.',
        'local-storage':'Browser storage is unavailable'}[error.code]);
      return;
    }
    authorized = false;
    status('offline', navigator.onLine ? 'Sync interrupted. Retrying…' : 'Offline · saved locally');
    clearTimeout(retryTimer);
    if (navigator.onLine) {
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 60000);
    }
  }

  async function transact(session, update) {
    return session.db.runTransaction(async tx => {
      const remote = cloudProgress(await tx.get(session.ref));
      if (session !== connection) throw Object.assign(new Error('The sync profile changed.'), {code:'cancelled'});
      const local = localProgress();
      const merged = merge(local, remote || local);
      if (update) update(merged);
      if (!remote || stable(merged) !== stable(remote)) {
        if (new TextEncoder().encode(JSON.stringify(merged)).length > 700 * 1024)
          console.warn('PhotoClass progress exceeds 700 KiB.');
        tx.set(session.ref, {schemaVersion: 1, app: 'photoclass-subject', progress: merged,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(), lastDevice: device(),
          lastClientSavedAt: merged.updatedAt});
      }
      return merged;
    });
  }

  function requirePhotoSession() {
    if (!connection || !authorized || !navigator.onLine) {
      throw Object.assign(new Error('Connect to your sync profile to save photos.'), {photoRejected:true});
    }
    return connection;
  }

  async function getCloudPhoto(assignmentId, photoId) {
    const session = requirePhotoSession();
    const data = cloudProgress(await session.ref.get({source: 'server'}));
    if (session !== connection) throw new Error('The sync profile changed.');
    return data?.playbook.assignments[assignmentId]?.photos?.[photoId] || null;
  }

  async function admitPhoto(assignmentId, photoId, record, limit) {
    const session = requirePhotoSession();
    let committed;
    try {
      committed = await transact(session, progress => {
        const assignments = progress.playbook.assignments;
        const at = record.updatedAt;
        const assignment = assignments[assignmentId] ||= {
          status:'todo', statusAt:at, currentSince:null, doneAt:null, updatedAt:at, photos:{}
        };
        const existing = assignment.photos[photoId];
        if (existing?.deleted) throw Object.assign(new Error('This photo was deleted.'), {photoRejected:true});
        if (existing) return; // A previous admission may have lost its acknowledgement.
        if (Object.values(assignment.photos).filter(photo => !photo.deleted).length >= limit) {
          throw Object.assign(new Error('This assignment has reached its photo limit.'), {code:'photo-limit', photoRejected:true});
        }
        assignment.photos[photoId] = record;
        assignment.updatedAt = later(assignment.updatedAt, at);
        progress.updatedAt = later(progress.updatedAt, at);
      });
    } catch (error) {
      // Network interruptions leave the record in the photo journal for a server-backed lookup.
      if (['permission-denied','invalid-argument','invalid-local','unsupported-data'].includes(error?.code)) {
        error.photoRejected = true;
      }
      throw error;
    }
    if (session !== connection) return;
    const latest = merge(localProgress(), committed);
    apply(latest);
    if (stable(latest) !== stable(committed)) schedulePush();
  }

  async function flush(session) {
    if (!session || session !== connection || !authorized || !navigator.onLine) return;
    if (busy) { queued = true; return; }
    busy = true;
    status('syncing', 'Syncing…');
    try {
      const committed = await transact(session);
      if (session !== connection) return;
      const latest = merge(localProgress(), committed);
      apply(latest);
      queued ||= stable(committed) !== stable(latest);
      localStorage.setItem(lastKey, new Date().toISOString());
      status('synced', 'Synced');
    } catch (error) { fail(error, session); }
    finally {
      if (session === connection) {
        busy = false;
        if (queued) { queued = false; schedulePush(); }
      }
    }
  }

  function schedulePush() {
    if (!connection || !authorized || !navigator.onLine) return;
    clearTimeout(timer);
    const session = connection;
    status('pending', 'Saved locally · sync pending');
    timer = setTimeout(() => flush(session), 850);
  }
  function connect() {
    stopListening?.();
    stopListening = null;
    clearTimeout(timer);
    clearTimeout(retryTimer);
    connection = null;
    authorized = false;
    busy = false;
    queued = false;
    const code = getSyncCode();
    if (!configured() || !code) { status('local_only', 'Local only'); return; }
    if (!navigator.onLine) { status('offline', 'Offline · saved locally'); return; }
    status('connecting', 'Connecting…');
    try {
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.PHOTOCLASS_FIREBASE_CONFIG);
      const db = app.firestore();
      const session = {db, ref: db.collection('subject_profiles').doc(code)};
      connection = session;
      stopListening = session.ref.onSnapshot({includeMetadataChanges: true}, snap => {
        if (session !== connection || snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
        try {
          const remote = cloudProgress(snap);
          const local = localProgress();
          const combined = merge(local, remote || local);
          authorized = true;
          apply(combined);
          if (!remote || stable(remote) !== stable(combined)) schedulePush();
          else {
            localStorage.setItem(lastKey, new Date().toISOString());
            status('synced', 'Synced');
          }
          retryDelay = 1500;
        } catch (error) { fail(error, session); }
      }, error => fail(error, session));
    } catch { status('error', 'Firebase configuration is unavailable'); }
  }
  function setSyncCode(value) {
    const code = String(value || '').trim();
    if (!/^[A-Za-z0-9_-]{24,128}$/.test(code)) throw new Error('Use 24–128 letters, digits, underscores or hyphens.');
    localStorage.setItem(codeKey, code);
    connect();
    return getStatus();
  }
  function clearSyncCode() {
    localStorage.removeItem(codeKey);
    localStorage.removeItem(lastKey);
    connect();
  }
  window.PhotoClassSync = {getStatus, getSyncCode, setSyncCode, generateSyncCode, clearSyncCode, schedulePush,
    getCloudPhoto, admitPhoto};
  window.addEventListener('photoclass-sdk-ready', connect);
  window.addEventListener('online', connect);
  window.addEventListener('offline', connect);
  window.addEventListener('storage', e => {
    if (e.key === codeKey || e.key === null) connect();
    if (e.key === prefix + 'progress-v1') window.dispatchEvent(new CustomEvent('photoclass-sync-progress-updated'));
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connect, {once: true});
  else connect();
})();
