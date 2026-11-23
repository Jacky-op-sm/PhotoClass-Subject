# Firestore progress sync

The production site uses the default Firestore database in the PhotoClass Subject project on the Spark plan. Photos are saved in the photographer's chosen folder. The browser synchronizes only progress and photo metadata.

1. To configure a fresh installation, create a Firebase project and register a Web App. Copy its public Web settings into `assets/js/firebase-config.js`.
2. Under Firestore Database, create the default Standard database in production mode. The production site uses Iowa (`us-central1`).
3. Under Indexes → Automatic, add a collection-scope exemption for the map field `progress` in `subject_profiles` and disable its automatic indexes. The app reads one document by its exact path.
4. Generate a private code in **Sync settings** and keep it in your password manager. Paste the [Firestore rules template](firestore.rules.template) into Firestore → Rules, substitute that code in the console, and publish. Keep the deployed rules out of Git.
5. Save the same code on each browser and origin. After **Synced** appears, connect the local photo folder to view images on that device.

See [Firebase's Web setup](https://firebase.google.com/docs/web/setup) and [Firestore quotas](https://firebase.google.com/docs/firestore/quotas).
