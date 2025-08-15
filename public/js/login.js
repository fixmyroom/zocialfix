import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  FacebookAuthProvider,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase-config.js"; // your config file

const auth = getAuth();

// Smart login helper
async function smartSignIn(provider) {
  try {
    // Try popup first
    const result = await signInWithPopup(auth, provider);
    await handleLoginSuccess(result.user);
  } catch (error) {
    console.warn("Popup login failed, trying redirect...", error.code);

    // Fallback to redirect (avoids COOP warning)
    await signInWithRedirect(auth, provider);
  }
}

// Handle login success
async function handleLoginSuccess(user) {
  const uid = user.uid;

  // Check Firestore for profile data
  const userDoc = await getDoc(doc(db, "users", uid));
  if (!userDoc.exists()) {
    // New user → role selection page
    window.location.href = "role.html";
    return;
  }

  const data = userDoc.data();
  if (!data.profileComplete) {
    window.location.href = "profile.html";
    return;
  }

  // Redirect based on role
  switch (data.role) {
    case "customer":
      window.location.href = "customer-dashboard.html";
      break;
    case "worker":
      window.location.href = "worker-dashboard.html";
      break;
    case "store":
      window.location.href = "store-dashboard.html";
      break;
    case "admin":
      window.location.href = "admin-dashboard.html";
      break;
    default:
      window.location.href = "role.html";
      break;
  }
}

// Google button click
document.getElementById("google-login").addEventListener("click", () => {
  smartSignIn(new GoogleAuthProvider());
});

// Facebook button click
document.getElementById("facebook-login").addEventListener("click", () => {
  smartSignIn(new FacebookAuthProvider());
});
