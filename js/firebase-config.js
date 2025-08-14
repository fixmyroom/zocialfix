// Import Firebase modules directly from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Your web app's Firebase configuration
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

// Export for use in index.html
export { auth, provider, firestore };
