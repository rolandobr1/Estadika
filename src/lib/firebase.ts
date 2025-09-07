
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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
const auth = getAuth(app);


export { app, db, auth };
