import { auth, firestore, rtdb } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  ref,
  onValue,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

let map;
const markers = new Map();

function initMap() {
  map = L.map('map').setView([27.7, 85.3], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
}

function clearMarkers() {
  markers.forEach((marker) => map.removeLayer(marker));
  markers.clear();
}

function addUserMarker(user) {
  if (!user.location || !user.location.lat || !user.location.lng) return;
  const id = user.uid;
  if (markers.has(id)) {
    markers.get(id).setLatLng([user.location.lat, user.location.lng]);
    return;
  }

  const color = user.role === 'worker' ? '#e74c3c' : '#f39c12';
  const icon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="font-size: 1.5rem; color: ${color}">${user.role === 'worker' ? '👷' : '👤'}</div>`,
  });

  const phoneHtml =
    user.phoneNumber && user.phoneNumber !== 'N/A'
      ? `<a href="tel:${user.phoneNumber}" style="color:#0af; word-break: break-word;">${user.phoneNumber}</a>`
      : 'No phone number';

  const marker = L.marker([user.location.lat, user.location.lng], { icon })
    .addTo(map)
    .bindPopup(`
      <b>${user.displayName || 'Unknown'}</b><br/>
      Role: ${user.role}<br/>
      Email: ${user.email || 'N/A'}<br/>
      Premium: ${user.premium ? 'Yes' : 'No'}<br/>
      Phone: ${phoneHtml}
    `);

  markers.set(id, marker);
}

function addJobMarker(job) {
  if (!job.location || !job.location.lat || !job.location.lng) return;
  const id = job.id;
  if (markers.has(id)) {
    markers.get(id).setLatLng([job.location.lat, job.location.lng]);
    return;
  }

  const icon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="font-size: 1.5rem; color: #f39c12;">🛠️ ${job.jobType}</div>`,
  });

  const phoneHtml = job.assignedWorkerPhone
    ? `<a href="tel:${job.assignedWorkerPhone}" style="color:#ff5722; word-break: break-word;">${job.assignedWorkerPhone}</a>`
    : 'No phone number';

  const marker = L.marker([job.location.lat, job.location.lng], { icon })
    .addTo(map)
    .bindPopup(`
      <b>Job Request</b><br/>
      Type: ${job.jobType}<br/>
      Status: ${job.status || 'Pending'}<br/>
      Customer ID: ${job.customerId}<br/>
      Assigned Worker: ${job.assignedWorkerName || 'None'}<br/>
      Phone: ${phoneHtml}
    `);

  markers.set(id, marker);
}

// Check admin role
async function checkAdmin(user) {
  try {
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    if (!snap.exists()) {
      window.location.href = 'role.html';
      return false;
    }
    const data = snap.data();
    if (data.role !== 'admin') {
      alert('Access denied. Admins only.');
      window.location.href = `${data.role}-dashboard.html`;
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error checking admin role:', err);
    window.location.href = 'index.html';
    return false;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const isAdmin = await checkAdmin(user);
  if (!isAdmin) return;

  initMap();

  const userListEl = document.getElementById('user-list');
  const jobListEl = document.getElementById('job-list');

  if (userListEl) userListEl.innerHTML = '<li>Loading users...</li>';
  if (jobListEl) jobListEl.innerHTML = '<li>Loading jobs...</li>';

  const EXPIRY_MS = 60 * 60 * 1000;
  const jobStatusCache = new Map();

  // Users listener
  const usersCol = collection(firestore, 'users');
  onSnapshot(usersCol, (snapshot) => {
    if (!userListEl) return;
    userListEl.innerHTML = '';
    snapshot.docs.forEach((docSnap) => {
      const userData = docSnap.data();
      userData.uid = docSnap.id;

      const phone = userData.phoneNumber || userData.phone || null;
      const phoneDisplay = phone ? phone : 'No phone number';

      const li = document.createElement('li');
      li.style.marginBottom = '1rem';
      li.style.wordBreak = 'break-word';
      li.innerHTML = `
        <strong>${userData.displayName || 'Unknown'}</strong> (${userData.role || 'No Role'})<br/>
        <small>Phone: ${phoneDisplay}</small>
      `;

      const premiumBtn = document.createElement('button');
      premiumBtn.textContent = userData.premium ? 'Revoke Premium' : 'Make Premium';
      premiumBtn.style.marginTop = '5px';
      premiumBtn.onclick = async () => {
        try {
          await updateDoc(doc(firestore, 'users', userData.uid), {
            premium: !userData.premium,
          });
        } catch (err) {
          alert('Error updating premium status: ' + err.message);
        }
      };
      li.appendChild(premiumBtn);
      userListEl.appendChild(li);
    });
  });

  // Jobs listener
  const jobsCol = collection(firestore, 'jobRequests');
  onSnapshot(jobsCol, async (snapshot) => {
    if (!jobListEl) return;
    jobListEl.innerHTML = '';

    if (snapshot.empty) {
      jobListEl.innerHTML = '<li>No job requests found.</li>';
      return;
    }

    const now = Date.now();

    for (const docSnap of snapshot.docs) {
      const job = docSnap.data();
      job.id = docSnap.id;

      const prevStatus = jobStatusCache.get(job.id);
      if (job.status === 'Confirmed' && prevStatus !== 'Confirmed') {
        alert(`Job "${job.jobType}" (ID: ${job.id}) has been accepted by worker.`);
      }
      jobStatusCache.set(job.id, job.status);

      if (job.status === 'Completed' && job.createdAt && now - job.createdAt.toMillis() > EXPIRY_MS) continue;

      if (job.assignedWorkerId) {
        try {
          const workerDoc = await getDoc(doc(firestore, 'users', job.assignedWorkerId));
          if (workerDoc.exists()) {
            const workerData = workerDoc.data();
            job.assignedWorkerName = workerData.displayName || 'Worker';
            job.assignedWorkerPhone = workerData.phoneNumber || workerData.phone || null;
          }
        } catch {
          job.assignedWorkerName = 'Error fetching worker';
          job.assignedWorkerPhone = null;
        }
      }

      addJobMarker(job);

      const li = document.createElement('li');
      li.style.marginBottom = '1rem';
      li.style.wordBreak = 'break-word';
      li.innerHTML = `
        <strong>${job.jobType}</strong> — Status: ${job.status || 'Pending'}<br/>
        Assigned to: ${job.assignedWorkerName || 'None'}<br/>
        Phone: ${
          job.assignedWorkerPhone
            ? `<a href="tel:${job.assignedWorkerPhone}" style="color:#ff5722;">${job.assignedWorkerPhone}</a>`
            : 'No phone number'
        }
      `;

      if (job.status === 'Pending') {
        const approveBtn = document.createElement('button');
        approveBtn.textContent = 'Approve';
        approveBtn.onclick = async () => {
          try {
            await updateDoc(doc(firestore, 'jobRequests', job.id), { status: 'Confirmed' });
            alert('Job approved');
          } catch (err) {
            alert('Error approving job: ' + err.message);
          }
        };

        const rejectBtn = document.createElement('button');
        rejectBtn.textContent = 'Reject';
        rejectBtn.onclick = async () => {
          try {
            await updateDoc(doc(firestore, 'jobRequests', job.id), { status: 'Rejected' });
            alert('Job rejected');
          } catch (err) {
            alert('Error rejecting job: ' + err.message);
          }
        };

        li.appendChild(approveBtn);
        li.appendChild(rejectBtn);
      }

      jobListEl.appendChild(li);
    }
  });

  // RTDB workers
  const workersRef = ref(rtdb, 'workers');
  let rtdbTimeout = null;
  onValue(workersRef, async (snapshot) => {
    if (rtdbTimeout) clearTimeout(rtdbTimeout);
    rtdbTimeout = setTimeout(async () => {
      clearMarkers();
      const workersData = snapshot.val() || {};
      for (const [uid, loc] of Object.entries(workersData)) {
        if (!loc.lat || !loc.lng) continue;
        try {
          const userDoc = await getDoc(doc(firestore, 'users', uid));
          if (!userDoc.exists()) continue;
          const userData = userDoc.data();

          addUserMarker({
            uid,
            location: loc,
            displayName: userData.displayName,
            role: userData.role,
            premium: userData.premium,
            email: userData.email,
            phoneNumber: userData.phoneNumber || userData.phone || 'N/A',
          });
        } catch (err) {
          console.error('Error fetching user data for marker:', err);
        }
      }
    }, 300);
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });
});
