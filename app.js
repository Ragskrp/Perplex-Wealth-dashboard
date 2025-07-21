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

// Initialize Firebase with long polling to fix transport errors
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Enable long polling to fix WebChannel transport errors
db.settings({ experimentalForceLongPolling: true });

let currentUser = null;
let spendingChart = null;
let assetChart = null;

// UI Elements
const authSection = document.getElementById('auth-section');
const dashboardContainer = document.getElementById('dashboard-container');
const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const headerSignOutBtn = document.getElementById('header-signout-btn');
const welcomeMsg = document.getElementById('welcome-msg');
const statusSpan = document.getElementById('status');
const userEmailSpan = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');
const currentDateSpan = document.getElementById('current-date');

// --- DATA STRUCTURE ---
let dashboardData = {
  Bank: [], 
  Investments: [], 
  Properties: [], 
  OtherAssets: [],
  Liabilities: [], 
  Insurance: []
};

function setStatus(msg) { 
  if (statusSpan) statusSpan.textContent = msg; 
}

// --- Date Display ---
function updateCurrentDate() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  if (currentDateSpan) {
    currentDateSpan.textContent = now.toLocaleDateString('en-US', options);
  }
}

// --- Auth UI Management ---
function updateAuthUI(user) {
  if (user) {
    // Show dashboard, hide auth
    if (authSection) authSection.style.display = 'none';
    if (dashboardContainer) dashboardContainer.style.display = 'block';
    
    // Update user info
    if (userEmailSpan) userEmailSpan.textContent = user.email;
    if (userAvatar) userAvatar.src = user.photoURL || '/default-avatar.png';
    if (headerSignOutBtn) headerSignOutBtn.style.display = 'inline-block';
    
    updateCurrentDate();
  } else {
    // Show auth, hide dashboard
    if (authSection) authSection.style.display = 'flex';
    if (dashboardContainer) dashboardContainer.style.display = 'none';
    
    // Reset user info
    if (userEmailSpan) userEmailSpan.textContent = '';
    if (userAvatar) userAvatar.src = '';
    if (headerSignOutBtn) headerSignOutBtn.style.display = 'none';
  }
}

// --- Auth Event Handlers ---
if (signInBtn) {
  signInBtn.onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => setStatus("Sign-in failed: " + e.message));
  };
}

if (signOutBtn) {
  signOutBtn.onclick = () => auth.signOut();
}

if (headerSignOutBtn) {
  headerSignOutBtn.onclick = () => auth.signOut();
}

// --- Auth State Listener ---
auth.onAuthStateChanged(user => {
  if (user) {
    if (allowedEmails.includes((user.email || '').toLowerCase())) {
      currentUser = user;
      updateAuthUI(user);
      loadDashboard();
    } else {
      alert("Access denied for this email address.");
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

// --- Firestore Operations ---
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
      .then(() => setStatus('Data saved successfully!'))
      .catch((e) => {
        console.error('Save error:', e);
        setStatus('Error saving: ' + e.message);
      });
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
        setStatus('Data loaded successfully');
      } else {
        setStatus('No saved data found, starting fresh');
        dashboardData = {
          Bank: [], Investments: [], Properties: [], OtherAssets: [], 
          Liabilities: [], Insurance: []
        };
        redrawDashboard();
      }
    })
    .catch(e => {
      console.error('Load error:', e);
      setStatus('Error loading: ' + e.message);
    });
}

function clearDashboard() {
  dashboardData = {
    Bank: [], Investments: [], Properties: [], OtherAssets: [], 
    Liabilities: [], Insurance: []
  };
  redrawDashboard();
}

// --- Chart Functions ---
function initializeCharts() {
  // Only initialize if canvas elements exist
  if (document.getElementById('spendingChart')) {
    initSpendingChart();
  }
  if (document.getElementById('assetChart')) {
    initAssetChart();
  }
}

function initSpendingChart() {
  const canvas = document.getElementById('spendingChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  spendingChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [
          '#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316'
        ],
        borderWidth: 2,
        borderColor: '#1e293b'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#f1f5f9',
            padding: 20,
            font: {
              family: 'Inter',
              size: 12
            }
          }
        }
      }
    }
  });
}

function initAssetChart() {
  const canvas = document.getElementById('assetChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  assetChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [
          '#14b8a6', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316'
        ],
        borderWidth: 2,
        borderColor: '#1e293b'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#f1f5f9',
            padding: 20,
            font: {
              family: 'Inter',
              size: 12
            }
          }
        }
      }
    }
  });
}

function updateSpendingChart() {
  if (!spendingChart) return;
  
  // Group spending data by category (you can customize categories)
  const spendingByCategory = {};
  
  // Add liabilities as spending categories
  dashboardData.Liabilities.forEach(liability => {
    const category = liability.details || 'Other';
    spendingByCategory[category] = (spendingByCategory[category] || 0) + Number(liability.value || 0);
  });
  
  // If no spending data, show sample data
  if (Object.keys(spendingByCategory).length === 0) {
    spendingByCategory['Housing'] = 3452;
    spendingByCategory['Personal'] = 2200;
    spendingByCategory['Transportation'] = 2190;
  }
  
  const labels = Object.keys(spendingByCategory);
  const data = Object.values(spendingByCategory);
  
  spendingChart.data.labels = labels;
  spendingChart.data.datasets[0].data = data;
  spendingChart.update();
}

function updateAssetChart() {
  if (!assetChart) return;
  
  // Group assets by type
  const assetsByType = {
    'Bank': sumArr(dashboardData.Bank, 'value'),
    'Investments': sumArr(dashboardData.Investments, 'value'),
    'Properties': sumArr(dashboardData.Properties, 'value'),
    'Other Assets': sumArr(dashboardData.OtherAssets, 'value'),
    'Insurance': sumArr(dashboardData.Insurance, 'value')
  };
  
  // Remove zero values
  const filteredAssets = {};
  Object.entries(assetsByType).forEach(([key, value]) => {
    if (value > 0) filteredAssets[key] = value;
  });
  
  const labels = Object.keys(filteredAssets);
  const data = Object.values(filteredAssets);
  
  assetChart.data.labels = labels;
  assetChart.data.datasets[0].data = data;
  assetChart.update();
}

// --- Dashboard Rendering ---
function redrawDashboard() {
  updateSummaryCards();
  updateIncomeSourcesList();
  updateDataTables();
  updateCharts();
  updateGoalProgress();
}

function updateSummaryCards() {
  const bankTotal = sumArr(dashboardData.Bank, 'value');
  const investmentsTotal = sumArr(dashboardData.Investments, 'value');
  const propertiesTotal = sumArr(dashboardData.Properties, 'value');
  const otherAssetsTotal = sumArr(dashboardData.OtherAssets, 'value');
  const liabilitiesTotal = sumArr(dashboardData.Liabilities, 'value');
  const insuranceTotal = sumArr(dashboardData.Insurance, 'value');
  
  const totalAssets = bankTotal + investmentsTotal + propertiesTotal + otherAssetsTotal;
  const netWorth = totalAssets + insuranceTotal - liabilitiesTotal;
  
  // Update summary card values
  updateElement('availableBalance', fmtMoney(bankTotal));
  updateElement('netWorth', fmtMoney(netWorth));
  updateElement('totalAssets', fmtMoney(totalAssets));
  updateElement('totalLiabilities', fmtMoney(liabilitiesTotal));
  updateElement('totalInsurance', fmtMoney(insuranceTotal));
}

function updateIncomeSourcesList() {
  const container = document.getElementById('incomeSourcesList');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Sample income sources (you can modify this to use real data)
  const incomeSources = [
    { name: 'Salary', amount: 13000 },
    { name: 'My Shop', amount: 8000 },
    { name: 'E-commerce', amount: 2100 },
    { name: 'Google Adsense', amount: 950 }
  ];
  
  incomeSources.forEach(source => {
    const item = document.createElement('div');
    item.className = 'income-source-item';
    item.innerHTML = `
      <span class="income-source-name">${source.name}</span>
      <span class="income-source-amount">${fmtMoney(source.amount)}</span>
    `;
    container.appendChild(item);
  });
}

function updateDataTables() {
  // Assets table
  const assetsTbody = document.getElementById('assetsTbody');
  if (assetsTbody) {
    assetsTbody.innerHTML = '';
    ['Bank', 'Investments', 'Properties', 'OtherAssets'].forEach(type => {
      dashboardData[type].forEach(row => {
        assetsTbody.appendChild(createAssetRow(type, row));
      });
    });
  }
  
  // Liabilities table
  const liabilitiesTbody = document.getElementById('liabilitiesTbody');
  if (liabilitiesTbody) {
    liabilitiesTbody.innerHTML = '';
    dashboardData.Liabilities.forEach(row => {
      liabilitiesTbody.appendChild(createLiabilityRow(row));
    });
  }
  
  // Insurance table
  const insuranceTbody = document.getElementById('insuranceTbody');
  if (insuranceTbody) {
    insuranceTbody.innerHTML = '';
    dashboardData.Insurance.forEach(row => {
      insuranceTbody.appendChild(createInsuranceRow(row));
    });
  }
}

function updateCharts() {
  updateSpendingChart();
  updateAssetChart();
}

function updateGoalProgress() {
  const totalIncome = 24050; // You can calculate this from real data
  const goalAmount = 39276;
  const progress = Math.round((totalIncome / goalAmount) * 100);
  
  updateElement('goalProgress', progress + '%');
  updateElement('goalDetails', `${fmtMoney(totalIncome)} / ${fmtMoney(goalAmount)}`);
  
  const progressFill = document.getElementById('progressFill');
  if (progressFill) {
    progressFill.style.width = progress + '%';
  }
}

// --- Utility Functions ---
function updateElement(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function sumArr(arr, key) {
  return arr.reduce((sum, item) => sum + Number(item[key] || 0), 0);
}

function fmtMoney(amount) {
  return '$' + Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function createAssetRow(type, row) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${type}</td>
    <td>${row.name || ''}</td>
    <td>${row.institution || row.provider || '-'}</td>
    <td>${fmtMoney(row.value || 0)}</td>
    <td>${row.currency || 'USD'}</td>
    <td>${row.details || ''}</td>
  `;
  return tr;
}

function createLiabilityRow(row) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${row.name || ''}</td>
    <td>${row.institution || ''}</td>
    <td>${fmtMoney(row.value || 0)}</td>
    <td>${row.currency || 'USD'}</td>
    <td>${row.date || ''}</td>
  `;
  return tr;
}

function createInsuranceRow(row) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${row.name || ''}</td>
    <td>${row.provider || ''}</td>
    <td>${fmtMoney(row.value || 0)}</td>
    <td>${row.currency || 'USD'}</td>
    <td>${row.details || ''}</td>
    <td>${row.date || ''}</td>
  `;
  return tr;
}

// --- Form Handling ---
const entryForm = document.getElementById('entryForm');
if (entryForm) {
  entryForm.onsubmit = function(e) {
    e.preventDefault();
    if (!currentUser) return setStatus("Sign in first");

    const type = document.getElementById('entryType').value;
    const name = document.getElementById('inputName').value.trim();
    const institution = document.getElementById('inputInstitution').value.trim();
    const value = parseFloat(document.getElementById('inputValue').value) || 0;
    const currency = document.getElementById('inputCurrency').value.trim() || 'USD';
    const details = document.getElementById('inputDetails').value.trim();
    const date = document.getElementById('inputDate').value;

    if (!name) return setStatus("Name is required");

    // Build entry object
    let entry = { name, value, currency };

    if (type === 'Bank' || type === 'Investment' || type === 'Property' || type === 'OtherAsset') {
      entry.institution = institution;
      if (details) entry.details = details;
    }

    if (type === 'Liability') {
      entry.institution = institution;
      entry.date = date;
      if (details) entry.details = details;
    }

    if (type === 'Insurance') {
      entry.provider = institution;
      entry.details = details;
      entry.date = date;
    }

    // Map type to data structure key
    let structKey = '';
    switch(type) {
      case 'Bank': structKey = 'Bank'; break;
      case 'Investment': structKey = 'Investments'; break;
      case 'Property': structKey = 'Properties'; break;
      case 'OtherAsset': structKey = 'OtherAssets'; break;
      case 'Liability': structKey = 'Liabilities'; break;
      case 'Insurance': structKey = 'Insurance'; break;
    }

    if (type === 'Bank') {
      // Only update the matching entry, otherwise append
      let found = false;
      for (let i = 0; i < dashboardData.Bank.length; i++) {
        if (dashboardData.Bank[i].name === name) {
          dashboardData.Bank[i] = entry;
          found = true;
          break;
        }
      }
      if (!found) {
        dashboardData.Bank.push(entry);
      }
      setStatus(`${found ? 'Updated' : 'Added'} Bank: ${name}`);
    } else {
      // For other types, keep previous logic
      let updated = false;
      dashboardData[structKey] = dashboardData[structKey].map(row => {
        if (row.name === name) {
          updated = true;
          return entry;
        }
        return row;
      });
      if (!updated) {
        dashboardData[structKey].push(entry);
      }
      setStatus(`${updated ? 'Updated' : 'Added'} ${type}: ${name}`);
    }

    // Clear form
    entryForm.reset();

    // Update display
    redrawDashboard();
  };
}

// --- Save Button ---
const saveBtn = document.getElementById('saveBtn');
if (saveBtn) {
  saveBtn.onclick = saveDashboard;
}

// --- Initialize Charts when DOM is ready ---
document.addEventListener('DOMContentLoaded', function() {
  // Initialize charts after a short delay to ensure DOM is fully rendered
  setTimeout(() => {
    initializeCharts();
  }, 100);
  
  updateCurrentDate();
  
  // Update date every minute
  setInterval(updateCurrentDate, 60000);
});

// --- Page Load Initialization ---
window.addEventListener('load', function() {
  // Ensure auth state is properly handled on page load
  updateAuthUI(null); // Start with auth view
});
