// -- 1. Allowed email list (whitelist): EDIT this for your allowed users --
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

// -- Dashboard data structure --
let dashboardData = {
  Bank: [], Investments: [], Properties: [], OtherAssets: [],
  Liabilities: [], Insurance: []
};

function setStatus(m) { statusSpan.textContent = m; }

// -- Auth UI/state --
function updateAuthUI(user) {
  if (user) {
    welcomeMsg.textContent = `Welcome, ${user.email}`;
    signInBtn.style.display = 'none';
    signOutBtn.style.display = 'inline-block';
    document.getElementById('forms').style.display = '';
    document.getElementById('dataTables').style.display = '';
    document.getElementById('summary').style.display = '';
  } else {
    welcomeMsg.textContent = 'Not signed in';
    signInBtn.style.display = 'inline-block';
    signOutBtn.style.display = 'none';
    document.getElementById('forms').style.display = 'none';
    document.getElementById('dataTables').style.display = 'none';
    document.getElementById('summary').style.display = 'none';
  }
}

// -- Show/hide UI depending on sign-in --
window.addEventListener('DOMContentLoaded', ()=>{
  updateAuthUI(null); // hide everything until login
});

// -- Auth event handlers --
signInBtn.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(e => setStatus("Sign-in failed: " + e.message));
};
signOutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
  if (user) {
    if (allowedEmails.includes((user.email || '').toLowerCase())) {
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

// -- Fallback for hidden "Load" button (load on login instead) --
document.getElementById('loadBtn').style.display = 'none';

// -- Firestore doc key per user
function userDocKey() {
  if (!currentUser) throw new Error("No user signed in");
  return "dashboard_" + currentUser.uid;
}

// -- Firestore Save/Load --
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

// -- Dashboard redraw --
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
  // Net Worth = assets + insurance - liabilities
  const assetsTotal =
    sumArr(dashboardData.Bank, 'value') +
    sumArr(dashboardData.Investments, 'value') +
    sumArr(dashboardData.Properties, 'value') +
    sumArr(dashboardData.OtherAssets, 'value') +
    sumArr(dashboardData.Insurance, 'value');
  const liabilitiesTotal = sumArr(dashboardData.Liabilities, 'value');
  document.getElementById('netWorth').textContent =
    fmtMoney(assetsTotal - liabilitiesTotal);

  // Fill assets table
  const assetsTbody = document.getElementById('assetsTbody');
  assetsTbody.innerHTML = '';
  ['Bank', 'Investments', 'Properties', 'OtherAssets'].forEach(type => {
    dashboardData[type].forEach(row => {
      assetsTbody.appendChild(assetRow(type, row));
    });
  });
  // Liabilities
  const liabilitiesTbody = document.getElementById('liabilitiesTbody');
  liabilitiesTbody.innerHTML = '';
  dashboardData.Liabilities.forEach(row => {
    liabilitiesTbody.appendChild(liabilityRow(row));
  });
  // Insurance
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

// -- Add/Update form --
document.getElementById('entryForm').onsubmit = function(e) {
  e.preventDefault();
  if (!currentUser) return setStatus("Sign in first");
  const type = document.getElementById('entryType
