// js/profile.js
import { auth, firestore } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const profileForm = document.getElementById('profile-form');
const nameInput = document.getElementById('name');
const addressInput = document.getElementById('address');
const phoneInput = document.getElementById('phone');
const workTypeSelect = document.getElementById('workType');
const errorMsg = document.getElementById('error-msg');

function showError(message) {
  errorMsg.textContent = "❌ " + message;
}

function clearError() {
  errorMsg.textContent = "";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  try {
    const userDoc = await getDoc(doc(firestore, 'users', user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      nameInput.value = data.displayName || '';
      addressInput.value = data.address || '';
      phoneInput.value = data.phone || '';
      if (data.role === 'worker') {
        workTypeSelect.value = data.workType || '';
        workTypeSelect.parentElement.style.display = 'block';
      } else {
        workTypeSelect.parentElement.style.display = 'none';
      }
    }
  } catch (e) {
    console.error(e);
  }
});

profileForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const user = auth.currentUser;
  if (!user) {
    alert('Sign in first');
    return;
  }

  const displayName = nameInput.value.trim();
  const address = addressInput.value.trim();
  const phone = phoneInput.value.trim();
  const workType = workTypeSelect.value;

  if (!displayName || !address || !phone) {
    showError('Please fill all required fields.');
    return;
  }

  try {
    const updateData = {
      displayName,
      address,
      phone,
      profileComplete: true
    };
    if (workType && workType !== '') {
      updateData.workType = workType;
    }
    await updateDoc(doc(firestore, 'users', user.uid), updateData);
    const updatedDoc = await getDoc(doc(firestore, 'users', user.uid));
    const role = updatedDoc.data().role;
    window.location.href = `${role}-dashboard.html`;
  } catch (err) {
    showError('Failed to update profile: ' + err.message);
  }
});
