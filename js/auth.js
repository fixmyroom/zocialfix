// js/auth.js
import { auth, firestore, provider } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Login button (page must have #email, #password, #loginBtn)
export async function initLoginHandlers({ emailSelector = '#email', passwordSelector = '#password', loginBtnSelector = '#loginBtn', signupBtnSelector = '#signupBtn', googleBtnSelector = '#googleLogin' } = {}) {
  const emailEl = document.querySelector(emailSelector);
  const passEl = document.querySelector(passwordSelector);
  const loginBtn = document.querySelector(loginBtnSelector);
  const signupBtn = document.querySelector(signupBtnSelector);
  const googleBtn = document.querySelector(googleBtnSelector);

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email = emailEl.value.trim();
      const password = passEl.value;
      if (!email || !password) return alert('Please enter email and password');
      if (!validateEmail(email)) return alert('Please enter a valid email');
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        // ensure user doc exists
        const uRef = doc(firestore, 'users', cred.user.uid);
        const snap = await getDoc(uRef);
        if (!snap.exists()) {
          await setDoc(uRef, { uid: cred.user.uid, email: cred.user.email, role: null, premium: false, createdAt: serverTimestamp() });
        }
        window.location.href = 'role.html';
      } catch (err) {
        alert(err.message);
      }
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener('click', () => {
      window.location.href = 'signup.html';
    });
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      try {
        const res = await signInWithPopup(auth, provider);
        const user = res.user;
        const uRef = doc(firestore, 'users', user.uid);
        const snap = await getDoc(uRef);
        if (!snap.exists()) {
          await setDoc(uRef, { uid: user.uid, email: user.email, displayName: user.displayName || '', role: null, premium: false, createdAt: serverTimestamp() });
        }
        window.location.href = 'role.html';
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Auto redirect if already logged in
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = 'role.html';
    }
  });
}

// Signup page handler (if you keep a separate signup page)
export async function initSignup({ displayNameSelector = '#displayName', emailSelector = '#email', passwordSelector = '#password', roleSelector = '#role', createBtnSelector = '#btnCreate', msgSelector = '#msg' } = {}) {
  const displayNameEl = document.querySelector(displayNameSelector);
  const emailEl = document.querySelector(emailSelector);
  const pwdEl = document.querySelector(passwordSelector);
  const roleEl = document.querySelector(roleSelector);
  const createBtn = document.querySelector(createBtnSelector);
  const msgEl = document.querySelector(msgSelector);

  createBtn.addEventListener('click', async () => {
    const displayName = displayNameEl.value.trim();
    const email = emailEl.value.trim();
    const password = pwdEl.value;
    const role = roleEl.value || 'customer';
    if (!displayName) { msgEl.textContent = 'Please enter full name'; return; }
    if (!email || !validateEmail(email)) { msgEl.textContent = 'Enter a valid email'; return; }
    if (!password || password.length < 6) { msgEl.textContent = 'Password min 6 chars'; return; }

    msgEl.textContent = 'Creating account...';
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(firestore, 'users', res.user.uid), {
        uid: res.user.uid,
        displayName,
        email,
        role,
        premium: false,
        createdAt: serverTimestamp()
      });
      msgEl.textContent = 'Account created — redirecting...';
      setTimeout(() => window.location.href = 'role.html', 900);
    } catch (err) {
      msgEl.textContent = 'Failed: ' + (err.message || err.code);
    }
  });
}

export { signOut as doSignOut };
