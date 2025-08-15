// public/js/firebase-config.js

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAB5KK4gMMwCAzmxjzTRAd0gK-gzpzbzmw",
  authDomain: "fixmyroomwithzocial.firebaseapp.com",
  databaseURL: "https://fixmyroomwithzocial-default-rtdb.firebaseio.com",
  projectId: "fixmyroomwithzocial",
  storageBucket: "fixmyroomwithzocial.firebasestorage.app",
  messagingSenderId: "594671909340",
  appId: "1:594671909340:web:9a9feedefed205a50ef719"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const firestore = getFirestore(app);
const rtdb = getDatabase(app);

// Export modules for use in other JS files
export { auth, provider, firestore, rtdb };
