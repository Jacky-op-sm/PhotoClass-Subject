// All application writes pass through this local-first boundary.
const STORAGE_KEY = 'photoclass-subject-progress-v1';

function localDay(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
function createEmptyProgress() {
  return {
    version: 1,
    startedAt: localDay(),
    updatedAt: new Date().toISOString(),
    onbeing: { segments: {} },
    playbook: { assignments: {} },
    subjects: {},
  };
}
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validProgress(value) {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.startedAt) ||
    !isRecord(value.onbeing?.segments) ||
    !isRecord(value.playbook?.assignments) ||
    !isRecord(value.subjects)
  )
    return false;
  const records = (map, test) =>
    Object.entries(map).every(
      ([id, data]) =>
        !['__proto__', 'constructor', 'prototype'].includes(id) &&
        isRecord(data) &&
        test(data)
    );
  return (
    records(value.onbeing.segments, (s) => typeof s.read === 'boolean') &&
    records(
      value.playbook.assignments,
      (a) =>
        ['todo', 'current', 'done', 'skipped'].includes(a.status) &&
        records(
          a.photos || {},
          (p) =>
            p.deleted ||
            (typeof p.thumbUrl === 'string' && typeof p.displayUrl === 'string')
        )
    ) &&
    records(
      value.subjects,
      (s) =>
        s.deleted ||
        (typeof s.text === 'string' &&
          s.text.length <= 200 &&
          ['interest', 'project'].includes(s.kind) &&
          Array.isArray(s.links))
    )
  );
}
function getProgress() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    const data = JSON.parse(raw);
    if (!validProgress(data))
      throw Error(
        'Stored progress could not be read. Restore a progress backup.'
      );
    return data;
  }
  const data = createEmptyProgress();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}
function saveProgress(data, options = {}) {
  try {
    if (options.touch !== false) data.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (options.sync !== false) window.PhotoClassSync?.schedulePush?.(data);
    return true;
  } catch (error) {
    console.error('Progress could not be saved.', error.name);
    return false;
  }
}
function exportProgress() {
  return JSON.stringify(getProgress(), null, 2);
}
function importProgress(json) {
  try {
    const data = JSON.parse(json);
    if (!validProgress(data))
      throw Error('Choose a PhotoClass: Subject progress backup.');
    if (
      Object.values(data.playbook.assignments).filter(
        (a) => a.status === 'current'
      ).length > 1
    )
      throw Error('The backup contains multiple current assignments.');
    if (!saveProgress(data, { touch: false }))
      throw Error('Browser storage is full or unavailable.');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
}
