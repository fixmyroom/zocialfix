// js/role.js
import { auth, firestore } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const adminEmail = "pratikaryal1986@gmail.com";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  // Hide admin option if user is not admin email
  const roleSelect = document.getElementById('role');
  if (roleSelect && user.email !== adminEmail) {
    const adminOption = roleSelect.querySelector('option[value="admin"]');
    if (adminOption) adminOption.remove();
  }

  try {
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data();

      // Only allow admin email to access admin dashboard
      if (data.role === 'admin' && user.email !== adminEmail) {
        alert('You are not allowed to access admin dashboard!');
        window.location.href = 'role.html';
        return;
      }

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

  // Prevent non-admin emails from picking admin
  if (role === 'admin' && user.email !== adminEmail) {
    alert('You cannot select admin role!');
    return;
  }

  try {
    await setDoc(doc(firestore, 'users', user.uid), { role, profileComplete: false }, { merge: true });
    // Redirect after setting role
    if (role === 'admin') {
      window.location.href = 'admin-dashboard.html';
    } else {
      window.location.href = 'profile.html';
    }
  } catch (err) {
    alert('Error saving role: ' + err.message);
  }
});
