// Only this browser origin remembers the directory handle. The marker lets another
// browser recognise the same Finder folder without ever storing its absolute path.
window.PhotoFolder = (() => {
  'use strict';
  const marker = '.photoclass-library.json';
  const thumbs = '.photoclass-thumbnails';
  const supported =
    typeof window.showDirectoryPicker === 'function' && !!window.indexedDB;
  let database,
    selection,
    readable = false,
    writable = false,
    issue = '';

  function db() {
    if (!database)
      database = new Promise((resolve, reject) => {
        const request = indexedDB.open('photoclass-subject-folders', 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('settings');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    return database;
  }
  async function setting(value) {
    const conn = await db();
    return new Promise((resolve, reject) => {
      const tx = conn.transaction('settings', value ? 'readwrite' : 'readonly');
      const store = tx.objectStore('settings');
      const req = value ? store.put(value, 'active') : store.get('active');
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = () =>
        reject(tx.error || Error('Photo folder settings could not be saved.'));
    });
  }
  async function write(handle, data) {
    const stream = await handle.createWritable();
    try {
      await stream.write(data);
      await stream.close();
    } catch (error) {
      await stream.abort().catch(() => {});
      throw error;
    }
  }
  async function readId(root) {
    const file = await (await root.getFileHandle(marker)).getFile();
    if (file.size < 512) {
      const info = JSON.parse(await file.text());
      if (
        info.app === 'photoclass-subject' &&
        info.version === 1 &&
        /^[0-9a-f-]{36}$/.test(info.id)
      )
        return info.id;
    }
    throw Error('This folder has an unrecognised PhotoClass library file.');
  }
  async function verify(selected) {
    if ((await readId(selected.root)) !== selected.id)
      throw Error('Choose the original photo folder again.');
  }
  async function hasEntry(root, name, kind) {
    try {
      if (kind === 'directory') await root.getDirectoryHandle(name);
      else await root.getFileHandle(name);
      return true;
    } catch (e) {
      if (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')
        return false;
      throw e;
    }
  }
  async function refreshPermission() {
    readable = writable = false;
    if (!selection) return;
    if (
      (await selection.root.queryPermission({ mode: 'read' })) === 'granted'
    ) {
      await verify(selection);
      readable = true;
      writable =
        (await selection.root.queryPermission({ mode: 'readwrite' })) ===
        'granted';
    }
  }
  const ready = (async () => {
    if (!supported) return;
    try {
      selection = await setting();
      await refreshPermission();
    } catch {
      issue = 'Choose your photo folder again to open this library.';
    }
  })();
  function status() {
    return {
      supported,
      name: selection?.root.name || '',
      id: selection?.id,
      readable,
      writable,
      issue,
    };
  }
  async function choose() {
    const root = await window.showDirectoryPicker({
      id: 'photoclass-photos',
      mode: 'readwrite',
    });
    if (
      (await hasEntry(root, '.git', 'directory')) ||
      ((await hasEntry(root, 'index.html')) &&
        (await hasEntry(root, 'vercel.json')))
    )
      throw Error('Choose a photo folder outside the website project.');
    const id = await navigator.locks.request(
      'photoclass-library-marker',
      async () => {
        try {
          return await readId(root);
        } catch (e) {
          if (e.name !== 'NotFoundError') throw e;
        }
        const id = crypto.randomUUID();
        await write(
          await root.getFileHandle(marker, { create: true }),
          JSON.stringify({ app: 'photoclass-subject', version: 1, id }) + '\n'
        );
        return id;
      }
    );
    const next = { root, id };
    await setting(next);
    selection = next;
    issue = '';
    await refreshPermission();
  }
  async function reconnect() {
    if (!selection) return choose();
    if (
      (await selection.root.requestPermission({ mode: 'readwrite' })) !==
      'granted'
    ) {
      await refreshPermission();
      throw Error(
        'Allow folder access in Chrome or Edge, or choose a folder again.'
      );
    }
    await refreshPermission();
    issue = '';
  }
  function access(writeAccess = false) {
    if (!selection || !(writeAccess ? writable : readable))
      throw Error('Reconnect your photo folder.');
    return selection;
  }
  async function topicDir(root, parts, create = false) {
    let dir = root;
    for (const part of parts)
      dir = await dir.getDirectoryHandle(part, { create });
    return dir;
  }
  async function fileHandle(selected, photo, id, variant, create = false) {
    if (selected.id !== photo.libraryId || !validFolderPhoto(photo, id))
      throw Error('This photo belongs to a different library.');
    const dir =
      variant === 'thumb'
        ? await selected.root.getDirectoryHandle(thumbs, { create })
        : await topicDir(selected.root, photo.folders, create);
    const name = variant === 'thumb' ? id + '.jpg' : photo.fileName;
    return { dir, name };
  }
  async function file(selected, photo, id, variant) {
    const { dir, name } = await fileHandle(selected, photo, id, variant);
    return (await dir.getFileHandle(name)).getFile();
  }
  async function save(selected, photo, id, variant, blob) {
    const { dir, name } = await fileHandle(selected, photo, id, variant, true);
    await write(await dir.getFileHandle(name, { create: true }), blob);
  }
  async function remove(selected, photo, id) {
    for (const variant of ['thumb', 'display']) {
      try {
        const { dir, name } = await fileHandle(selected, photo, id, variant);
        await dir.removeEntry(name);
      } catch (error) {
        if (error.name !== 'NotFoundError') throw error;
      }
    }
  }
  async function topics() {
    if (!readable) return [];
    const result = [];
    for await (const item of selection.root.values())
      if (item.kind === 'directory' && validFolderPart(item.name))
        result.push(item.name);
    return result.sort((a, b) => a.localeCompare(b));
  }
  return {
    ready,
    status,
    choose,
    reconnect,
    access,
    verify,
    save,
    file,
    remove,
    topics,
  };
})();
