// js/contact-admin.js
import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const logoutBtn = document.getElementById('logout-btn');
const form = document.getElementById('contact-form');

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('status-msg').textContent = 'Thank you — admin will respond soon.';
    form.reset();
  });
}
