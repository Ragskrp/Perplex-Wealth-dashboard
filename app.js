// --- 1. Allowed emails: Replace with your allowed users ---
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

// Enable long polling to fix transport errors
db.settings({ experimentalForceLongPolling: true });

let currentUser = null;
const statusSpan = document.getElementById('status');
const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const welcomeMsg = document.getElementById('welcome-msg');

// --- DATA STRUCTURE ---
let dashboardData = {
  Bank: [], Investments: [], Properties: [], OtherAssets: [],
  Liabilities: [], Insurance: []
};

// Chart instances to prevent memory leaks
let spendingChart = null;
let assetChart = null;
let incomeExpenseChart = null;

function setStatus(msg) { statusSpan.textContent = msg; }

// --- Visibility handling ---
function updateDashboardVisibility(user) {
  const authCard = document.getElementById('auth-card');
  const dashboard = document.getElementById('dashboard-content');
  
  if (user) {
    if (authCard) authCard.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';
  } else {
    if (authCard) authCard.style.display = 'block';
    if (dashboard) dashboard.style.display = 'none';
  }
}

function updateAuthUI(user) {
  if (user) {
    welcomeMsg.textContent = `Welcome, ${user.displayName || user.email}`;
    signInBtn.style.display = 'none';
    signOutBtn.style.display = '';
    updateDashboardVisibility(true);
  } else {
    welcomeMsg.textContent = 'Not signed in';
    signInBtn.style.display = '';
    signOutBtn.style.display = 'none';
    updateDashboardVisibility(false);
  }
}

// Default: hide everything until auth handled
window.addEventListener('DOMContentLoaded', () => {
  updateDashboardVisibility(false);
});

// --- Auth handlers ---
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

// --- FIRESTORE PER-USER DOC ---
function userDocKey() {
  if (!currentUser) throw new Error("No user signed in");
  return "dashboard_" + currentUser.uid;
}

function saveDashboard() {
  if (!currentUser) return setStatus("Sign in first");
  
  try {
    // Clean data to remove undefined values
    const cleanData = JSON.parse(JSON.stringify(dashboardData));
    
    db.collection('dashboards').doc(userDocKey()).set(cleanData)
      .then(() => setStatus('Saved!'))
      .catch((e) => setStatus('Error saving: ' + e.message));
  } catch (error) {
    setStatus('Data validation error: ' + error.message);
  }
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

// --- RENDER UI ---
function redrawDashboard() {
  updateFinancialSummary();
  updateDataTables();
  updateCharts();
}

function updateFinancialSummary() {
  const bankTotal = sumArr(dashboardData.Bank, 'value');
  const investmentsTotal = sumArr(dashboardData.Investments, 'value');
  const propertiesTotal = sumArr(dashboardData.Properties, 'value');
  const otherAssetsTotal = sumArr(dashboardData.OtherAssets, 'value');
  const liabilitiesTotal = sumArr(dashboardData.Liabilities, 'value');
  const insuranceTotal = sumArr(dashboardData.Insurance, 'value');
  
  // Update summary cards
  updateElement('bankTotal', fmtMoney(bankTotal));
  updateElement('investmentsTotal', fmtMoney(investmentsTotal));
  updateElement('propertiesTotal', fmtMoney(propertiesTotal));
  updateElement('otherAssetsTotal', fmtMoney(otherAssetsTotal));
  updateElement('liabilitiesTotal', fmtMoney(liabilitiesTotal));
  updateElement('insuranceTotal', fmtMoney(insuranceTotal));
  
  const assetsTotal = bankTotal + investmentsTotal + propertiesTotal + otherAssetsTotal + insuranceTotal;
  updateElement('netWorth', fmtMoney(assetsTotal - liabilitiesTotal));
  
  // Update available balance (could be bank total or a specific calculation)
  updateElement('availableBalance', fmtMoney(bankTotal));
  
  // Update total spendings and income
  updateElement('totalSpendings', fmtMoney(liabilitiesTotal));
  updateElement('totalIncome', fmtMoney(assetsTotal));
  
  // Update goal progress (example: 61% of income goal)
  const incomeGoal = 39276; // Example goal
  const progressPercent = Math.min((assetsTotal / incomeGoal) * 100, 100);
  updateElement('incomeGoal', `${progressPercent.toFixed(0)}%`);
  
  const progressBar = document.getElementById('goalProgress');
  if (progressBar) {
    progressBar.style.width = `${progressPercent}%`;
  }
}

function updateDataTables() {
  // Assets table
  const assetsTbody = document.getElementById('assetsTbody');
  if (assetsTbody) {
    assetsTbody.innerHTML = '';
    ['Bank', 'Investments', 'Properties', 'OtherAssets'].forEach(type => {
      dashboardData[type].forEach(row => {
        assetsTbody.appendChild(assetRow(type, row));
      });
    });
  }
  
  // Liabilities table
  const liabilitiesTbody = document.getElementById('liabilitiesTbody');
  if (liabilitiesTbody) {
    liabilitiesTbody.innerHTML = '';
    dashboardData.Liabilities.forEach(row => {
      liabilitiesTbody.appendChild(liabilityRow(row));
    });
  }
  
  // Insurance table
  const insuranceTbody = document.getElementById('insuranceTbody');
  if (insuranceTbody) {
    insuranceTbody.innerHTML = '';
    dashboardData.Insurance.forEach(row => {
      insuranceTbody.appendChild(insuranceRow(row));
    });
  }
}

function updateCharts() {
  // Only update charts that exist in the HTML
  updateSpendingDonutChart();
  updateAssetAllocationChart();
  // Note: Removed trend charts as per user request
}

function updateSpendingDonutChart() {
  const canvas = document.getElementById('spendingChart');
  if (!canvas) return; // Skip if chart doesn't exist
  
  const ctx = canvas.getContext('2d');
  
  // Calculate spending categories
  const spendingData = {
    Housing: sumArr(dashboardData.Liabilities.filter(item => 
      item.name && item.name.toLowerCase().includes('house') || 
      item.name && item.name.toLowerCase().includes('rent') ||
      item.name && item.name.toLowerCase().includes('mortgage')), 'value'),
    Personal: sumArr(dashboardData.Liabilities.filter(item => 
      item.name && item.name.toLowerCase().includes('personal') ||
      item.name && item.name.toLowerCase().includes('credit')), 'value'),
    Transportation: sumArr(dashboardData.Liabilities.filter(item => 
      item.name && item.name.toLowerCase().includes('car') ||
      item.name && item.name.toLowerCase().includes('transport') ||
      item.name && item.name.toLowerCase().includes('auto')), 'value'),
    Other: 0
  };
  
  // Calculate remaining amount
  const totalLiabilities = sumArr(dashboardData.Liabilities, 'value');
  spendingData.Other = totalLiabilities - (spendingData.Housing + spendingData.Personal + spendingData.Transportation);
  
  if (spendingChart) {
    spendingChart.destroy();
  }
  
  spendingChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(spendingData),
      datasets: [{
        data: Object.values(spendingData),
        backgroundColor: ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444'],
        borderColor: '#1e293b',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: '#e2e8f0'
          }
        }
      }
    }
  });
}

function updateAssetAllocationChart() {
  const canvas = document.getElementById('assetChart');
  if (!canvas) return; // Skip if chart doesn't exist
  
  const ctx = canvas.getContext('2d');
  
  const assetData = {
    Bank: sumArr(dashboardData.Bank, 'value'),
    Investments: sumArr(dashboardData.Investments, 'value'),
    Properties: sumArr(dashboardData.Properties, 'value'),
    Other: sumArr(dashboardData.OtherAssets, 'value')
  };
  
  if (assetChart) {
    assetChart.destroy();
  }
  
  assetChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(assetData),
      datasets: [{
        data: Object.values(assetData),
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'],
        borderColor: '#1e293b',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: '#e2e8f0'
          }
        }
      }
    }
  });
}

// Helper functions
function updateElement(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
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

// --- FORM ADD/UPDATE ---
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
  
  // Clear form
  document.getElementById('entryForm').reset();
};

// Save button handler
const saveBtn = document.getElementById('saveBtn');
if (saveBtn) {
  saveBtn.onclick = saveDashboard;
}
