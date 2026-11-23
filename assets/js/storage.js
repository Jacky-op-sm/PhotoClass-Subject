// storage.js — localStorage CRUD for PhotoClass progress data
// Single localStorage key: photoclass-subject-progress-v1

const STORAGE_KEY = 'photoclass-subject-progress-v1';
const STORAGE_VERSION = 1;

// ── Initial state ─────────────────────────────────────────────
function createEmptyProgress() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    version: STORAGE_VERSION,
    startedAt: today,
    updatedAt: new Date().toISOString(),
    onbeing: { segments: {} },
    playbook: { assignments: {} },
    subjects: {},
  };
}

// ── Core read/write ───────────────────────────────────────────

function getProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyProgress();
    }
    const data = JSON.parse(raw);
    if (!data || data.version !== STORAGE_VERSION) {
      return createEmptyProgress();
    }
    return data;
  } catch (e) {
    return createEmptyProgress();
  }
}

function saveProgress(data, options) {
  options = options || {};
  try {
    data.version = STORAGE_VERSION;
    if (options.touch !== false) data.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (options.sync !== false && window.PhotoClassSync && window.PhotoClassSync.schedulePush) {
      window.PhotoClassSync.schedulePush(data);
    }
    return true;
  } catch (e) {
    console.error('Failed to save progress:', e);
    return false;
  }
}

function exportProgress() {
  const data = getProgress();
  return JSON.stringify(data, null, 2);
}

function importProgress(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data || data.version !== STORAGE_VERSION || !data.onbeing?.segments || !data.playbook?.assignments || !data.subjects) {
      return { success: false, error: 'Invalid progress data: missing study records.' };
    }
    if (!saveProgress(data, { touch: false })) return { success: false, error: "Storage is unavailable." };
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Could not parse JSON: ' + e.message };
  }
}

window.createEmptyProgress = createEmptyProgress;
window.getProgress = getProgress;
window.saveProgress = saveProgress;


function resetProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

