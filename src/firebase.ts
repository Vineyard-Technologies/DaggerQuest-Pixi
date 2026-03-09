/**
 * Firebase initialization.
 *
 * Replace the placeholder values below with your project's config
 * from the Firebase console → Project settings → Your apps → Web app.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: "AIzaSyCgr0MjqE5kIQ5t1s9uhapOtRV5Hls0dWA",
  authDomain: "daggerquest-backend.firebaseapp.com",
  projectId: "daggerquest-backend",
  storageBucket: "daggerquest-backend.firebasestorage.app",
  messagingSenderId: "705191332019",
  appId: "1:705191332019:web:d2a77ad951e88724b848c6",
  measurementId: "G-ZV37WNT3D6"
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

if (isLocal) {
    connectAuthEmulator(auth, 'http://localhost:9099');
}

// Skip App Check on localhost – the debug-token exchange requires a token
// registered in the Firebase Console and always produces noisy 403s otherwise.
if (!isLocal) {
    initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider('6Le04IQsAAAAAILL-EQAkLbBRrf25TzyKc2S0TUo'),
        isTokenAutoRefreshEnabled: true,
    });
}
