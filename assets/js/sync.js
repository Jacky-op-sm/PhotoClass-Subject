(function () {
  'use strict';
  const SYNC_CODE_KEY = 'photoclass-subject-sync-code-v1';
  const SYNC_ENABLED_KEY = 'photoclass-subject-sync-enabled-v1';
  const DEVICE_LABEL_KEY = 'photoclass-subject-device-label-v1';
  const LAST_SYNC_KEY = 'photoclass-subject-last-sync-v1';
  const COLLECTION = 'subject_profiles';
  function readLocal(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function writeLocal(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function removeLocal(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Ignore local cleanup failures.
    }
  }

  function getSyncCode() {
    return readLocal(SYNC_CODE_KEY) || '';
  }

  window.PhotoClassSync = { getSyncCode };
})();
