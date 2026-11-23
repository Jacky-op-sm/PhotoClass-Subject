// Load the ordered compat bundles only for a configured project.
if (window.PHOTOCLASS_FIREBASE_CONFIG?.projectId) {
  for (const name of ['app', 'firestore', 'storage']) {
    const script = document.createElement('script');
    script.async = false;
    script.src =
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-' +
      name +
      '-compat.js';
    if (name === 'storage')
      script.onload = () =>
        window.dispatchEvent(new Event('photoclass-sdk-ready'));
    document.head.append(script);
  }
}
