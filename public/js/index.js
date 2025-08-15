// js/index.js
import { auth, firestore, provider } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("error-msg");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const googleBtn = document.getElementById("google-signin-btn");

function showError(message) {
  errorMsg.textContent = "❌ " + message;
}

function clearError() {
  errorMsg.textContent = "";
}

loginBtn.addEventListener("click", async () => {
  clearError();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    return showError("Please enter email and password.");
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "role.html";
  } catch (error) {
    showError(error.message);
  }
});

signupBtn.addEventListener("click", async () => {
  clearError();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    return showError("Please enter email and password.");
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(firestore, "users", userCredential.user.uid), {
      email: email,
      role: null,
      displayName: null,
      premium: false,
      profileComplete: false,
      createdAt: new Date().toISOString()
    });
    window.location.href = "role.html";
  } catch (error) {
    showError(error.message);
  }
});

googleBtn.addEventListener("click", async () => {
  clearError();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userDoc = await getDoc(doc(firestore, "users", user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(firestore, "users", user.uid), {
        email: user.email,
        role: null,
        displayName: user.displayName || null,
        premium: false,
        profileComplete: false,
        createdAt: new Date().toISOString()
      });
    }
    window.location.href = "role.html";
  } catch (error) {
    showError(error.message);
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "role.html";
  }
});
