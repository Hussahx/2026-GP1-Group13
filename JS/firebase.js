// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD7_kFQDxLRMHYFuyiwcOuyZmApVLS-kl0",
  authDomain: "rasid-1bb06.firebaseapp.com",
  projectId: "rasid-1bb06",
  storageBucket: "rasid-1bb06.firebasestorage.app",
  messagingSenderId: "668525115587",
  appId: "1:668525115587:web:e017be3b5cbf4ac3b30a76",
  measurementId: "G-MZ3KB7WBK4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);