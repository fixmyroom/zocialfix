// js/role.js
import { auth, firestore } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  try {
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.role && data.profileComplete) {
        window.location.href = `${data.role}-dashboard.html`;
      } else if (data.role && !data.profileComplete) {
        window.location.href = 'profile.html';
      } else {
        window.location.href = 'role.html';
      }
    } else {
      window.location.href = 'role.html';
    }
  } catch (e) {
    console.error(e);
  }
});

document.getElementById('role-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const role = document.getElementById('role').value;
  const user = auth.currentUser;
  if (!user) {
    alert('Sign in first');
    return;
  }
  try {
    await setDoc(doc(firestore, 'users', user.uid), { role, profileComplete: false }, { merge: true });
    window.location.href = 'profile.html';
  } catch (err) {
    alert('Error saving role: ' + err.message);
  }
});
