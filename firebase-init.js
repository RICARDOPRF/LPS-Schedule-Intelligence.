import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
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

const authApi = {
  signInEmail: (email, password) => signInWithEmailAndPassword(auth, email, password),
  createAccount: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  resetPassword: email => sendPasswordResetEmail(auth, email),
  signOut: () => signOut(auth)
};

window.LPS_FIREBASE = {
  app,
  auth,
  db,
  authApi,
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
      displayName: user?.displayName || null,
      photoURL: user?.photoURL || null
    }
  }));
});

window.dispatchEvent(new CustomEvent('lps-firebase-ready', {
  detail: { projectId: firebaseConfig.projectId, database: true, auth: true, providers: ['password'] }
}));
