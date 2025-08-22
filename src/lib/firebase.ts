
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, enablePersistence } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "estadika-20",
  "appId": "1:799142083005:web:09b4474717230841227ad4",
  "storageBucket": "estadika-20.firebasestorage.app",
  "apiKey": "AIzaSyDUGVmjK-j7-LoSvyLCaYcRCK56uD6HrbA",
  "authDomain": "estadika-20.firebaseapp.com",
  "messagingSenderId": "799142083005"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Enable offline persistence
enablePersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled
    // in one tab at a time.
    console.warn('Firestore persistence failed: multiple tabs open.');
  } else if (err.code == 'unimplemented') {
    // The current browser does not support all of the
    // features required to enable persistence
    console.warn('Firestore persistence not available in this browser.');
  }
});

export { app, db };
