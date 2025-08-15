import { auth, firestore, rtdb } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  ref,
  set,
  remove
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

// Leaflet map and markers
let map;
const jobMarkers = new Map();
let workerMarker = null;

function initMap() {
  map = L.map('map').setView([27.7, 85.3], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}

async function addJobMarker(request, currentUserId) {
  if (!request.location?.lat || !request.location?.lng) return;

  const id = request.id;
  if (jobMarkers.has(id)) {
    jobMarkers.get(id).setLatLng([request.location.lat, request.location.lng]);
    return;
  }

  // Fetch customer info for popup
  let customerName = 'Customer';
  let customerPhone = '';
  try {
    const customerDoc = await getDoc(doc(firestore, 'users', request.customerId));
    if (customerDoc.exists()) {
      const custData = customerDoc.data();
      customerName = custData.displayName || customerName;
      customerPhone = custData.phone || custData.phoneNumber || '';
    }
  } catch (e) {
    console.warn('Error fetching customer info:', e);
  }

  // Popup content including Complete button if assigned to current user and Accepted
  let popupHtml = `
    <b>Job Request</b><br/>
    Type: ${request.jobType}<br/>
    Status: ${request.status || 'Pending'}<br/>
    Customer: ${customerName}<br/>
    ${customerPhone ? `Phone: <a href="tel:${customerPhone}">${customerPhone}</a><br/>` : ''}
  `;

  if (request.status === 'Accepted' && request.assignedWorkerId === currentUserId) {
    popupHtml += `<button id="complete-btn-${id}" style="margin-top:5px; padding: 5px 10px; cursor: pointer;">Complete Job</button>`;
  }

  const icon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="font-size: 1.5rem;">🛠️ ${request.jobType}</div>`
  });

  const marker = L.marker([request.location.lat, request.location.lng], { icon })
    .addTo(map)
    .bindPopup(popupHtml);

  jobMarkers.set(id, marker);

  // Attach Complete Job button event listener after popup opens
  marker.on('popupopen', () => {
    if (request.status === 'Accepted' && request.assignedWorkerId === currentUserId) {
      const btn = document.getElementById(`complete-btn-${id}`);
      if (btn) {
        btn.onclick = async () => {
          try {
            await updateDoc(doc(firestore, 'jobRequests', id), {
              status: 'Completed',
              completedAt: serverTimestamp()
            });
            alert('Job marked as completed!');
            marker.closePopup();
          } catch (error) {
            alert('Error completing job: ' + error.message);
          }
        };
      }
    }
  });
}

function clearJobMarkers() {
  jobMarkers.forEach(marker => map.removeLayer(marker));
  jobMarkers.clear();
}

async function updateWorkerLocation(uid, lat, lng) {
  try {
    const workerRef = ref(rtdb, `workers/${uid}`);
    await set(workerRef, {
      lat,
      lng,
      timestamp: Date.now(),
      online: true
    });

    if (workerMarker) {
      workerMarker.setLatLng([lat, lng]);
    } else {
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="font-size: 1.6rem; color: #00ff00;">👷 You</div>`
      });
      workerMarker = L.marker([lat, lng], { icon }).addTo(map).bindPopup('You are here');
    }
  } catch (error) {
    console.error('Error updating worker location:', error);
  }
}

async function removeWorkerLocation(uid) {
  try {
    const workerRef = ref(rtdb, `workers/${uid}`);
    await remove(workerRef);
  } catch (error) {
    console.error('Error removing worker location:', error);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  initMap();

  const jobListEl = document.getElementById('job-requests');
  jobListEl.innerHTML = '<li>Loading jobs...</li>';

  const jobsCol = collection(firestore, 'jobRequests');
  const jobsQuery = query(jobsCol, where('status', 'in', ['Pending', 'Accepted']));

  onSnapshot(jobsQuery, async (snapshot) => {
    jobListEl.innerHTML = '';
    clearJobMarkers();

    if (snapshot.empty) {
      jobListEl.innerHTML = '<li>No jobs available.</li>';
      return;
    }

    const now = Date.now();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    for (const docSnap of snapshot.docs) {
      const job = docSnap.data();
      job.id = docSnap.id;

      if (job.status === 'Accepted' && job.acceptedAt) {
        const acceptedAtMs = job.acceptedAt?.toMillis ? job.acceptedAt.toMillis() : job.acceptedAt;
        if (now - acceptedAtMs > TWO_HOURS_MS) {
          // Skip accepted jobs older than 2 hours
          continue;
        }
      }

      await addJobMarker(job, user.uid);

      const li = document.createElement('li');
      li.style.marginBottom = '0.8em';
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';

      // Show job type + customer ID partial
      let text = `${job.jobType} (Cust: ${job.customerId.substring(0, 6)})`;

      // For Pending jobs: show Accept button
      if (job.status === 'Pending') {
        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = 'Accept';
        acceptBtn.style.marginLeft = '10px';
        acceptBtn.style.padding = '0.3em 0.8em';
        acceptBtn.style.fontSize = '1rem';
        acceptBtn.style.borderRadius = '4px';
        acceptBtn.style.border = 'none';
        acceptBtn.style.backgroundColor = '#2196F3';
        acceptBtn.style.color = 'white';
        acceptBtn.style.cursor = 'pointer';

        acceptBtn.onclick = async () => {
          try {
            const jobDocRef = doc(firestore, 'jobRequests', job.id);
            const jobDocSnap = await getDoc(jobDocRef);
            if (!jobDocSnap.exists()) {
              alert('Job no longer exists.');
              return;
            }
            const currentStatus = jobDocSnap.data().status;
            if (currentStatus !== 'Pending') {
              alert('Job already accepted or closed.');
              return;
            }
            await updateDoc(jobDocRef, {
              status: 'Accepted',
              assignedWorkerId: user.uid,
              acceptedAt: serverTimestamp()
            });
            alert('Job accepted!');
          } catch (error) {
            alert('Error accepting job: ' + error.message);
          }
        };

        li.textContent = text;
        li.appendChild(acceptBtn);
      } else if (job.status === 'Accepted' && job.assignedWorkerId === user.uid) {
        // Show Complete Job button on list as well
        const completeBtn = document.createElement('button');
        completeBtn.textContent = 'Complete Job';
        completeBtn.style.marginLeft = '10px';
        completeBtn.style.padding = '0.3em 0.8em';
        completeBtn.style.fontSize = '1rem';
        completeBtn.style.borderRadius = '4px';
        completeBtn.style.border = 'none';
        completeBtn.style.backgroundColor = '#4CAF50';
        completeBtn.style.color = 'white';
        completeBtn.style.cursor = 'pointer';

        completeBtn.onclick = async () => {
          try {
            await updateDoc(doc(firestore, 'jobRequests', job.id), {
              status: 'Completed',
              completedAt: serverTimestamp()
            });
            alert('Job marked as completed!');
          } catch (error) {
            alert('Error completing job: ' + error.message);
          }
        };

        li.textContent = text;
        li.appendChild(completeBtn);
      } else {
        li.textContent = text;
      }

      jobListEl.appendChild(li);
    }
  });

  // Update worker live location continuously
  if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      await updateWorkerLocation(user.uid, lat, lng);

      if (!workerMarker) {
        map.setView([lat, lng], 14);
      }
    }, (err) => {
      console.warn('Geolocation error:', err.message);
      if (err.code === 1) {
        alert('Please allow location access for live tracking.');
      }
    }, {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 27000
    });
  } else {
    alert('Geolocation not supported by your browser.');
  }

  // On logout, remove live location and sign out
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await removeWorkerLocation(user.uid);
    await signOut(auth);
    window.location.href = 'index.html';
  });
});
