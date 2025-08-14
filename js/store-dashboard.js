// js/store-dashboard.js
import { auth, firestore } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { collection, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const ordersList = document.getElementById('orders-list');

  // Listen to jobRequests where storeId === current user.uid
  // Assuming you save storeId in jobRequests when assigned
  const q = query(collection(firestore, 'jobRequests'), where('storeId', '==', user.uid));
  onSnapshot(q, (snapshot) => {
    ordersList.innerHTML = '';
    if (snapshot.empty) {
      ordersList.innerHTML = '<li>No orders found.</li>';
      return;
    }
    snapshot.docs.forEach(docSnap => {
      const job = docSnap.data();
      const li = document.createElement('li');
      li.textContent = `${job.jobType} - Status: ${job.status || 'Pending'}`;
      ordersList.appendChild(li);
    });
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });
});
