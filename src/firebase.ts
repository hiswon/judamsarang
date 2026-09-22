import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase 콘솔에서 발급받은 실제 키 값들을 넣어주세요.
const firebaseConfig = {
  apiKey: "AIzaSyBxtfEfVZ2FuUJraE6j4MJ2961aFLXkHl8",
  authDomain: "father-c31a0.firebaseapp.com",
  projectId: "father-c31a0",
  storageBucket: "father-c31a0.firebasestorage.app",
  messagingSenderId: "786155447201",
  appId: "1:786155447201:web:6fd9b552e1b334ce2d21e0",
  measurementId: "G-EBQXEKXRHH"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// 다른 파일에서 가져다 쓸 수 있도록 export
export const auth = getAuth(app);
export const db = getFirestore(app);