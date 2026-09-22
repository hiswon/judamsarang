import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBxtfEfVZ2FuUJraE6j4MJ2961aFLXkHl8",
  authDomain: "father-c31a0.firebaseapp.com",
  projectId: "father-c31a0",
  storageBucket: "father-c31a0.firebasestorage.app",
  messagingSenderId: "786155447201",
  appId: "1:786155447201:web:6fd9b552e1b334ce2d21e0",
  measurementId: "G-EBQXEKXRHH"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);