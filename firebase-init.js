import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getDatabase, ref, set, update, push, get, query, orderByChild, limitToLast, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDGbh2mn4JpiIPm8mLD8KAw3XpbcUuMOy8',
  authDomain: 'lps-schedule-intelligence.firebaseapp.com',
  databaseURL: 'https://lps-schedule-intelligence-default-rtdb.firebaseio.com',
  projectId: 'lps-schedule-intelligence',
  storageBucket: 'lps-schedule-intelligence.firebasestorage.app',
  messagingSenderId: '3753894388',
  appId: '1:3753894388:web:822d1aa0e6fed7b27659a1',
  measurementId: 'G-4R93FZM20L'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

window.LPS_FIREBASE = {
  app,
  auth,
  db,
  database: { ref, set, update, push, get, query, orderByChild, limitToLast, serverTimestamp },
  config: {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    databaseURL: firebaseConfig.databaseURL
  },
  user: auth.currentUser || null,
  ready: true
};

onAuthStateChanged(auth, user => {
  window.LPS_FIREBASE.user = user || null;
  window.dispatchEvent(new CustomEvent('lps-auth-state', {
    detail: {
      signedIn: !!user,
      uid: user?.uid || null,
      email: user?.email || null,
      displayName: user?.displayName || null
    }
  }));
});

window.dispatchEvent(new CustomEvent('lps-firebase-ready', {
  detail: { projectId: firebaseConfig.projectId, database: true }
}));
