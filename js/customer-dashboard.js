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
  addDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  orderBy,
  limit,
  doc,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  ref,
  onValue
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

let map;
const workerMarkers = new Map();
const jobMarkers = new Map();
const notifiedJobs = new Set();
let assignedWorkerIds = new Set();

function initMap() {
  map = L.map('map').setView([27.7, 85.3], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
}

function clearMarkers(markersMap) {
  markersMap.forEach(marker => map.removeLayer(marker));
  markersMap.clear();
}

async function addWorkerMarker(worker) {
  if (!worker.location || !worker.location.lat || !worker.location.lng) return;
  if (!worker.online) return; // show only online workers
  const id = worker.id;

  if (workerMarkers.has(id)) {
    workerMarkers.get(id).setLatLng([worker.location.lat, worker.location.lng]);
    return;
  }

  let iconHtml = '👷';
  if (worker.workType) iconHtml += ` (${worker.workType})`;

  const icon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="font-size: 1.4rem;">${iconHtml}</div>`
  });

  const phoneNumber = worker.phone || worker.phoneNumber || null;

  const popupContent = `
    <b>${worker.displayName || 'Worker'}</b><br/>
    Type: ${worker.workType || 'N/A'}<br/>
    📞 ${phoneNumber ? `<a href="tel:${phoneNumber}" style="color:#ff5722;">Call</a>` : 'N/A'}
  `;

  const marker = L.marker([worker.location.lat, worker.location.lng], { icon })
    .addTo(map)
    .bindPopup(popupContent);

  workerMarkers.set(id, marker);
}

async function addJobRequestMarker(request) {
  if (!request.location || !request.location.lat || !request.location.lng) return;
  const id = request.id;

  if (jobMarkers.has(id)) {
    jobMarkers.get(id).setLatLng([request.location.lat, request.location.lng]);
    return;
  }

  const icon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="font-size: 1.6rem;">🛠️ ${request.jobType}</div>`
  });

  let workerInfoHtml = '';
  if (request.assignedWorkerId) {
    try {
      const workerDoc = await getDoc(doc(firestore, 'users', request.assignedWorkerId));
      if (workerDoc.exists()) {
        const workerData = workerDoc.data();
        const phone = workerData.phone || workerData.phoneNumber || null;
        workerInfoHtml = `<br/><b>Assigned Worker:</b> ${workerData.displayName || 'Worker'}<br/>📞 Phone: ${phone ? `<a href="tel:${phone}" style="color:#ff5722;">${phone}</a>` : 'N/A'}`;
      }
    } catch (e) {
      console.error('Error fetching assigned worker info:', e);
    }
  }

  const popupContent = `
    <b>Job Request</b><br/>
    Type: ${request.jobType}<br/>
    Status: ${request.status || 'Pending'}
    ${workerInfoHtml}
  `;

  const marker = L.marker([request.location.lat, request.location.lng], { icon })
    .addTo(map)
    .bindPopup(popupContent);

  jobMarkers.set(id, marker);
}

function adjustMapHeight() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  const vh = window.innerHeight;
  const headerHeight = document.querySelector('header')?.offsetHeight || 0;
  const footerHeight = document.querySelector('footer')?.offsetHeight || 0;
  const newHeight = vh - headerHeight - footerHeight;
  mapEl.style.height = newHeight + 'px';
  if (map) {
    map.invalidateSize();
  }
}

window.addEventListener('resize', adjustMapHeight);
window.addEventListener('orientationchange', adjustMapHeight);

const TWO_HOURS = 2 * 60 * 60 * 1000; // milliseconds

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  initMap();
  adjustMapHeight();

  const jobList = document.getElementById('job-list');
  jobList.innerHTML = '<li>Loading...</li>';

  const requestsCol = collection(firestore, 'jobRequests');

  // Updated query to include finished jobs so we can hide old finished jobs client-side
  const userRequestsQuery = query(
    requestsCol,
    where('customerId', '==', user.uid),
    where('status', 'in', ['Accepted', 'Confirmed', 'Ongoing', 'Finished']),
    orderBy('createdAt', 'desc')
  );

  onSnapshot(userRequestsQuery, async (snapshot) => {
    jobList.innerHTML = '';
    clearMarkers(jobMarkers);

    assignedWorkerIds.clear();

    if (snapshot.empty) {
      jobList.innerHTML = '<li>No ongoing job requests found.</li>';
      return;
    }

    const now = Date.now();

    for (const docSnap of snapshot.docs) {
      const req = docSnap.data();
      req.id = docSnap.id;

      // If finished, check finishedAt timestamp and skip if > 2 hours old
      if (req.status === 'Finished' && req.finishedAt) {
        const finishedAtMillis = req.finishedAt.toMillis ? req.finishedAt.toMillis() : req.finishedAt;
        if ((now - finishedAtMillis) > TWO_HOURS) {
          // skip displaying this job (simulate delete)
          continue;
        }
      }

      if (!['Accepted', 'Confirmed', 'Ongoing', 'Finished'].includes(req.status)) {
        continue; // skip unknown statuses
      }

      let listText = `🛠️ ${req.jobType} - Status: ${req.status || 'Pending'}`;

      if (req.assignedWorkerId) {
        assignedWorkerIds.add(req.assignedWorkerId);

        try {
          const workerDoc = await getDoc(doc(firestore, 'users', req.assignedWorkerId));
          if (workerDoc.exists()) {
            const workerData = workerDoc.data();
            const phone = workerData.phone || workerData.phoneNumber || null;
            listText += ` — Assigned to: ${workerData.displayName || 'Worker'} (📞 ${phone ? `<a href="tel:${phone}" style="color:#ff5722;">Call</a>` : 'N/A'})`;

            if (!notifiedJobs.has(req.id) && req.status === 'Accepted') {
              alert(
                `Your job "${req.jobType}" was accepted by ${workerData.displayName}.\n` +
                `Contact: ${phone || 'No phone available'}`
              );
              notifiedJobs.add(req.id);
            }
          }
        } catch (e) {
          console.error('Error fetching assigned worker data:', e);
        }
      }

      const li = document.createElement('li');
      li.innerHTML = listText;
      jobList.appendChild(li);

      await addJobRequestMarker(req);
    }
  });

  // Show only assigned workers on map from realtime DB
  const workersLocRef = ref(rtdb, 'workers');
  onValue(workersLocRef, (snapshot) => {
    const workersData = snapshot.val();
    clearMarkers(workerMarkers);
    if (workersData) {
      Object.entries(workersData).forEach(([id, worker]) => {
        if (worker.online && assignedWorkerIds.has(id)) {
          addWorkerMarker({ ...worker, id });
        }
      });
    }
  });

  // New job request form submit
  const form = document.getElementById('new-request-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const jobType = document.getElementById('jobType').value;
      if (!jobType) {
        alert('Please select a job type');
        return;
      }

      if (!navigator.geolocation) {
        alert('Geolocation not supported by your browser');
        return;
      }

      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          // Check for active pending jobs
          const qActive = query(requestsCol, where('customerId', '==', user.uid), where('status', '==', 'Pending'));
          const activeSnap = await getDocs(qActive);
          if (!activeSnap.empty) {
            alert('You already have an active job request. Please wait or cancel it before creating a new one.');
            return;
          }

          // Fetch user info
          const userDocRef = doc(firestore, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          let customerName = '';
          let customerPhone = '';
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            customerName = data.displayName || '';
            customerPhone = data.phone || data.phoneNumber || '';
          }

          await addDoc(requestsCol, {
            customerId: user.uid,
            customerName,
            customerPhone,
            jobType,
            status: 'Pending',
            createdAt: serverTimestamp(),
            location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }
          });

          alert('Job request created successfully!');
          form.reset();
        } catch (error) {
          alert('Error creating job request: ' + error.message);
        }
      }, () => {
        alert('Could not get your location. Please allow location access.');
      }, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      });
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut(auth);
      window.location.href = 'index.html';
    });
  }
});
