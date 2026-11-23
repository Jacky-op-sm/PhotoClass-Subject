// Load the ordered compat bundles only for a configured project.
if (window.PHOTOCLASS_FIREBASE_CONFIG?.projectId) {
  const bundles = ['app', 'firestore'];
  if (window.PHOTOCLASS_FIREBASE_CONFIG.storageBucket) bundles.push('storage');
  for (const name of bundles) {
    const script = document.createElement('script');
    script.async = false;
    script.src =
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-' +
      name +
      '-compat.js';
    if (name === bundles[bundles.length - 1])
      script.onload = () =>
        window.dispatchEvent(new Event('photoclass-sdk-ready'));
    document.head.append(script);
  }
}
