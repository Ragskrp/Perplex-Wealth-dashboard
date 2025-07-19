// --- ALLOWED EMAILS --- 
const allowedEmails = [
  "ragskrp@gmail.com",
  "shilpasingireddy21@gmail.com"
].map(e => e.toLowerCase());

// -- 2. Firebase config: PASTE YOUR VALUES BELOW --
const firebaseConfig = {
  apiKey: "AIzaSyCs_ZGApo6BqHE8RNb3jFs_R0MWT6um1zE",
  authDomain: "perplex-wealth-dashboard.firebaseapp.com",
  projectId: "perplex-wealth-dashboard",
  storageBucket: "perplex-wealth-dashboard.firebasestorage.app",
  messagingSenderId: "379744978413",
  appId: "1:379744978413:web:742f581736d13eefeb13e4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;
const statusSpan = document.getElementById('status');
const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const welcomeMsg = document.getElementById('welcome-msg');

// --- DASHBOARD DATA ---
let dashboardData = {
  Bank: [], Investments: [], Properties: [], OtherAssets: [],
  Liabilities: [], Insurance: []
};

function setStatus(m) { statusSpan.textContent = m; }

function updateAuthUI(user) {
  const show = user ? "" : "none";
  welcomeMsg.textContent = user ? `Welcome, ${user.email}` : "Not signed in";
  signInBtn.style.display = user ? "none" : "";
  signOutBtn.style.display = user ? "" : "none";
  document.getElementById('forms').style.display = show;
  document.getElementById('dataTables').style.display = show;
  document.getElementById('summary').style.display = show;
}

window.addEventListener('DOMContentLoaded', ()=>{
  updateAuthUI(null);
});

signInBtn.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(e => setStatus("Sign-in failed: " + e.message));
};
signOutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
  if (user) {
    if (allowedEmails.includes((user.email || "").toLowerCase())) {
      currentUser = user;
      updateAuthUI(user);
      loadDashboard();
    } else {
      alert("Access denied for this email.");
      auth.signOut();
      currentUser = null;
      updateAuthUI(null);
      clearDashboard();
    }
  } else {
    currentUser = null;
    updateAuthUI(null);
    clearDashboard();
  }
});

document.getElementById('loadBtn').style.display = 'none';

function userDocKey() {
  if (!currentUser) throw new Error("No user signed in");
  return "dashboard_" + currentUser.uid;
}

function saveDashboard() {
  if (!currentUser) return setStatus("Sign in first");
  db.collection('dashboards').doc(userDocKey()).set(dashboardData)
    .then(() => setStatus('Saved!'))
    .catch((e) => setStatus('Error saving: ' + e.message));
}
function loadDashboard() {
  if (!currentUser) return setStatus("Sign in first");
  db.collection('dashboards').doc(userDocKey()).get()
    .then(doc => {
      if (doc.exists) {
        dashboardData = doc.data();
        redrawDashboard();
        setStatus('Data loaded');
      } else {
        setStatus('No data found, starting fresh');
        dashboardData = {Bank: [], Investments: [], Properties: [], OtherAssets: [], Liabilities: [], Insurance: []};
        redrawDashboard();
      }
    }).catch(e => setStatus('Error loading: ' + e.message));
}
function clearDashboard() {
  dashboardData = {Bank: [], Investments: [], Properties: [], OtherAssets: [], Liabilities: [], Insurance: []};
  redrawDashboard();
}

function redrawDashboard() {
  document.getElementById('bankTotal').textContent =
    fmtMoney(sumArr(dashboardData.Bank, 'value'));
  document.getElementById('investmentsTotal').textContent =
    fmtMoney(sumArr(dashboardData.Investments, 'value'));
  document.getElementById('propertiesTotal').textContent =
    fmtMoney(sumArr(dashboardData.Properties, 'value'));
  document.getElementById('otherAssetsTotal').textContent =
    fmtMoney(sumArr(dashboardData.OtherAssets, 'value'));
  document.getElementById('liabilitiesTotal').textContent =
    fmtMoney(sumArr(dashboardData.Liabilities, 'value'));
  document.getElementById('insuranceTotal').textContent =
    fmtMoney(sumArr(dashboardData.Insurance, 'value'));
  const assetsTotal =
    sumArr(dashboardData.Bank, 'value') +
    sumArr(dashboardData.Investments, 'value') +
    sumArr(dashboardData.Properties, 'value') +
    sumArr(dashboardData.OtherAssets, 'value') +
    sumArr(dashboardData.Insurance, 'value');
  const liabilitiesTotal = sumArr(dashboardData.Liabilities, 'value');
  document.getElementById('netWorth').textContent =
    fmtMoney(assetsTotal - liabilitiesTotal);

  const assetsTbody = document.getElementById('assetsTbody');
  assetsTbody.innerHTML = '';
  ['Bank', 'Investments', 'Properties', 'OtherAssets'].forEach(type => {
    dashboardData[type].forEach(row => {
      assetsTbody.appendChild(assetRow(type, row));
    });
  });
  const liabilitiesTbody = document.getElementById('liabilitiesTbody');
  liabilitiesTbody.innerHTML = '';
  dashboardData.Liabilities.forEach(row => {
    liabilitiesTbody.appendChild(liabilityRow(row));
  });
  const insuranceTbody = document.getElementById('insuranceTbody');
  insuranceTbody.innerHTML = '';
  dashboardData.Insurance.forEach(row => {
    insuranceTbody.appendChild(insuranceRow(row));
  });
}
function sumArr(arr, key) {
  return arr.reduce((a, b) => a + Number(b[key] || 0), 0);
}
function fmtMoney(n) {
  return '$' + Number(n).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
}
function assetRow(type, row) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${type}</td>
    <td>${row.name}</td>
    <td>${row.institution || row.provider || '-'}</td>
    <td>${fmtMoney(row.value)}</td>
    <td>${row.currency}</td>
    <td>${row.details || ''}</td>`;
  return tr;
}
function liabilityRow(row) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${row.name}</td>
    <td>${row.institution}</td>
    <td>${fmtMoney(row.value)}</td>
    <td>${row.currency}</td>
    <td>${row.date || ''}</td>`;
  return tr;
}
function insuranceRow(row) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${row.name}</td>
    <td>${row.provider}</td>
    <td>${fmtMoney(row.value)}</td>
    <td>${row.currency}</td>
    <td>${row.details || ''}</td>
    <td>${row.date || ''}</td>`;
  return tr;
}

document.getElementById('entryForm').onsubmit = function(e) {
  e.preventDefault();
  if (!currentUser) return setStatus("Sign in first");
  const type = document.getElementById('entryType').value;
  const name = document.getElementById('inputName').value.trim();
  const institution = document.getElementById('inputInstitution').value.trim();
  const value = parseFloat(document.getElementById('inputValue').value);
  const currency = document.getElementById('inputCurrency').value.trim();
  const details = document.getElementById('inputDetails').value.trim();
  const date = document.getElementById('inputDate').value;
  if (!name) return setStatus("Name is required");
  let entry = {name, value, currency};
  if(type === 'Bank' || type === 'Investment' || type === 'Property' || type === 'OtherAsset') {
    entry.institution = institution;
    if(details) entry.details = details;
  }
  if(type === 'Liability') {
    entry.institution = institution;
    entry.date = date;
  }
  if(type === 'Insurance') {
    entry.provider = institution;
    entry.details = details;
    entry.date = date;
  }
  let structKey = '';
  switch(type) {
    case 'Bank': structKey = 'Bank'; break;
    case 'Investment': structKey = 'Investments'; break;
    case 'Property': structKey = 'Properties'; break;
    case 'OtherAsset': structKey = 'OtherAssets'; break;
    case 'Liability': structKey = 'Liabilities'; break;
    case 'Insurance': structKey = 'Insurance'; break;
  }
  let updated = false;
  dashboardData[structKey] = dashboardData[structKey].map(row =>{
    if(row.name === name) {
      updated = true; return entry;
    } else return row;
  });
  if (!updated) dashboardData[structKey].push(entry);
  redrawDashboard();
  setStatus(`${updated ? 'Updated' : 'Added'} ${type}`);
};

document.getElementById('saveBtn').onclick = saveDashboard;
