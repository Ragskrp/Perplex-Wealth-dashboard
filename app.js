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
  Insurance: [],
  LandAssets: []
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
  updateDataTables();
  updateCharts();
}

function updateSummaryCards() {
  // Calculate new summary values
  const bankTotal = sumArr(dashboardData.Bank, 'value');
  // Insurance Maturity Value: sum of 'value' field in Insurance
  const insuranceMaturityTotal = sumArr(dashboardData.Insurance, 'value');
  // Funds Worth: sum of all asset types (Bank, Investments, Properties, OtherAssets)
  const fundsWorth = bankTotal
    + sumArr(dashboardData.Investments, 'value')
    + sumArr(dashboardData.Properties, 'value')
    + sumArr(dashboardData.OtherAssets, 'value');

  updateElement('totalBankBalance', fmtMoney(bankTotal));
  updateElement('totalInsuranceMaturity', fmtMoney(insuranceMaturityTotal));
  updateElement('totalFundsWorth', fmtMoney(fundsWorth));
}

function updateDataTables() {
  // Banks Overview table (only Bank rows)
  const assetsTbody = document.getElementById('assetsTbody');
  if (assetsTbody) {
    assetsTbody.innerHTML = '';
    dashboardData.Bank.forEach((row, idx) => {
      assetsTbody.appendChild(createBankOverviewRow(row, idx));
    });
  }
  // Insurance table
  const insuranceTbody = document.getElementById('insuranceTbody');
  if (insuranceTbody) {
    insuranceTbody.innerHTML = '';
    dashboardData.Insurance.forEach((row, idx) => {
      insuranceTbody.appendChild(createInsuranceRow(row, idx));
    });
  }
  // Land Assets table
  let landTable = document.getElementById('landAssetsTable');
  if (landTable) {
    let tbody = landTable.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = '';
      dashboardData.LandAssets.forEach((row, idx) => {
        tbody.appendChild(createLandAssetRow(row, idx));
      });
    }
  }
}

function updateCharts() {
  updateAssetChart();
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
  return '₹' + Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function createAssetRow(type, row, idx) {
  // Deprecated: replaced by createBankOverviewRow for Banks Overview
}

function createBankOverviewRow(row, idx) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><span class="editable" data-type="bank" data-idx="${idx}" data-field="name">${row.name || ''}</span></td>
    <td><span class="editable" data-type="bank" data-idx="${idx}" data-field="value">${fmtMoney(row.value || 0)}</span></td>
    <td>INR</td>
  `;
  return tr;
}

function createBankRow(row, idx) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>Bank</td>
    <td><span class="editable" data-type="bank" data-idx="${idx}" data-field="name">${row.name || ''}</span></td>
    <td>${row.institution || '-'}</td>
    <td><span class="editable" data-type="bank" data-idx="${idx}" data-field="value">${fmtMoney(row.value || 0)}</span></td>
    <td><span class="editable" data-type="bank" data-idx="${idx}" data-field="currency">${row.currency || 'USD'}</span></td>
    <td>${row.details || ''}</td>
  `;
  return tr;
}

function createInvestmentRow(row, idx) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>Investments</td>
    <td><span class="editable" data-type="investments" data-idx="${idx}" data-field="name">${row.name || ''}</span></td>
    <td><span class="editable" data-type="investments" data-idx="${idx}" data-field="institution">${row.institution || '-'}</span></td>
    <td><span class="editable" data-type="investments" data-idx="${idx}" data-field="value">${fmtMoney(row.value || 0)}</span></td>
    <td><span class="editable" data-type="investments" data-idx="${idx}" data-field="currency">${row.currency || 'USD'}</span></td>
    <td><span class="editable" data-type="investments" data-idx="${idx}" data-field="details">${row.details || ''}</span></td>
  `;
  return tr;
}

function createPropertyRow(row, idx) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>Properties</td>
    <td><span class="editable" data-type="properties" data-idx="${idx}" data-field="name">${row.name || ''}</span></td>
    <td><span class="editable" data-type="properties" data-idx="${idx}" data-field="institution">${row.institution || '-'}</span></td>
    <td><span class="editable" data-type="properties" data-idx="${idx}" data-field="value">${fmtMoney(row.value || 0)}</span></td>
    <td><span class="editable" data-type="properties" data-idx="${idx}" data-field="currency">${row.currency || 'USD'}</span></td>
    <td><span class="editable" data-type="properties" data-idx="${idx}" data-field="details">${row.details || ''}</span></td>
  `;
  return tr;
}

function createOtherAssetRow(row, idx) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>OtherAssets</td>
    <td><span class="editable" data-type="otherassets" data-idx="${idx}" data-field="name">${row.name || ''}</span></td>
    <td><span class="editable" data-type="otherassets" data-idx="${idx}" data-field="institution">${row.institution || '-'}</span></td>
    <td><span class="editable" data-type="otherassets" data-idx="${idx}" data-field="value">${fmtMoney(row.value || 0)}</span></td>
    <td><span class="editable" data-type="otherassets" data-idx="${idx}" data-field="currency">${row.currency || 'USD'}</span></td>
    <td><span class="editable" data-type="otherassets" data-idx="${idx}" data-field="details">${row.details || ''}</span></td>
  `;
  return tr;
}

function createInsuranceRow(row, idx) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><span class="editable" data-type="insurance" data-idx="${idx}" data-field="name">${row.name || ''}</span></td>
    <td><span class="editable" data-type="insurance" data-idx="${idx}" data-field="provider">${row.provider || ''}</span></td>
    <td><span class="editable" data-type="insurance" data-idx="${idx}" data-field="value">${fmtMoney(row.value || 0)}</span></td>
    <td><span class="editable" data-type="insurance" data-idx="${idx}" data-field="premium">${row.premium || ''}</span></td>
    <td><span class="editable" data-type="insurance" data-idx="${idx}" data-field="date">${row.date || ''}</span></td>
  `;
  return tr;
}

// --- Form Handling ---
// --- Insurance Form Handling ---
const insuranceForm = document.getElementById('insuranceForm');
if (insuranceForm) {
  insuranceForm.onsubmit = function(e) {
    e.preventDefault();
    if (!currentUser) return setStatus("Sign in first");

    const company = document.getElementById('insuranceCompany').value.trim();
    const value = parseFloat(document.getElementById('insuranceValue').value) || 0;
    const date = document.getElementById('insuranceDate').value;
    const premium = parseFloat(document.getElementById('insurancePremium').value) || 0;

    if (!company) return setStatus("Insurance company is required");
    if (!date) return setStatus("Maturity date is required");

    let entry = {
      name: company,
      value: value,
      date: date,
      premium: premium
    };

    // Update or append
    let found = false;
    for (let i = 0; i < dashboardData.Insurance.length; i++) {
      if (dashboardData.Insurance[i].name === company) {
        dashboardData.Insurance[i] = entry;
        found = true;
        break;
      }
    }
    if (!found) {
      dashboardData.Insurance.push(entry);
    }
    setStatus(`${found ? 'Updated' : 'Added'} Insurance: ${company}`);

    insuranceForm.reset();
    redrawDashboard();
  };
}
// --- Bank Form Handling ---
const bankForm = document.getElementById('bankForm');
if (bankForm) {
  bankForm.onsubmit = function(e) {
    e.preventDefault();
    if (!currentUser) return setStatus("Sign in first");

    const name = document.getElementById('bankName').value.trim();
    let value = parseFloat(document.getElementById('bankBalance').value) || 0;
    const currency = document.getElementById('bankCurrency').value;

    if (!name) return setStatus("Bank name is required");

    // Convert GBP to INR if needed
    if (currency === 'GBP') {
      value = value * 100;
    }

    let entry = { name, value, currency: 'INR' };

    // Update or append
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

    bankForm.reset();
    redrawDashboard();
  };
}
// --- Land Asset Form Handling ---
const landForm = document.getElementById('landForm');
if (landForm) {
  landForm.onsubmit = function(e) {
    e.preventDefault();
    if (!currentUser) return setStatus("Sign in first");

    const location = document.getElementById('landLocation').value.trim();
    const size = document.getElementById('landSize').value.trim();
    const gps = document.getElementById('landGPS').value.trim();
    const registeredTo = document.getElementById('landRegisteredTo').value.trim();

    if (!location) return setStatus("Land location is required");
    if (!size) return setStatus("Land size is required");
    if (!gps) return setStatus("GPS coordinates are required");
    if (!registeredTo) return setStatus("Registered To is required");

    let entry = { location, size, gps, registeredTo };

    // Update or append
    let found = false;
    for (let i = 0; i < dashboardData.LandAssets.length; i++) {
      if (dashboardData.LandAssets[i].location === location && dashboardData.LandAssets[i].gps === gps) {
        dashboardData.LandAssets[i] = entry;
        found = true;
        break;
      }
    }
    if (!found) {
      dashboardData.LandAssets.push(entry);
    }
    setStatus(`${found ? 'Updated' : 'Added'} Land Asset: ${location}`);

    landForm.reset();
    redrawDashboard();
  };
}

// --- Save Button ---
const saveBtn = document.getElementById('saveBtn');
if (saveBtn) {
  saveBtn.onclick = saveDashboard;
}

const saveBtnFooter = document.getElementById('saveBtnFooter');
if (saveBtnFooter) {
  saveBtnFooter.onclick = saveDashboard;
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

// --- Inline Editing Handler ---
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('editable')) {
    const span = e.target;
    const type = span.getAttribute('data-type');
    const idx = parseInt(span.getAttribute('data-idx'));
    const field = span.getAttribute('data-field');
    let oldValue;
    let inputType = 'text';
    if (type === 'bank') {
      oldValue = dashboardData.Bank[idx][field];
      if (field === 'value') inputType = 'number';
    } else if (type === 'investments') {
      oldValue = dashboardData.Investments[idx][field];
      if (field === 'value') inputType = 'number';
    } else if (type === 'properties') {
      oldValue = dashboardData.Properties[idx][field];
      if (field === 'value') inputType = 'number';
    } else if (type === 'otherassets') {
      oldValue = dashboardData.OtherAssets[idx][field];
      if (field === 'value') inputType = 'number';
    } else if (type === 'insurance') {
      oldValue = dashboardData.Insurance[idx][field];
      if (field === 'value' || field === 'premium') inputType = 'number';
    } else if (type === 'land') {
      oldValue = dashboardData.LandAssets[idx][field];
    }
    const input = document.createElement('input');
    input.type = inputType;
    input.value = oldValue;
    input.className = 'inline-edit-input';
    span.replaceWith(input);
    input.focus();
    input.onblur = function() {
      const newValue = input.value.trim();
      if (newValue !== oldValue && newValue !== '') {
        if (type === 'bank') {
          dashboardData.Bank[idx][field] = inputType === 'number' ? parseFloat(newValue) : newValue;
        } else if (type === 'investments') {
          dashboardData.Investments[idx][field] = inputType === 'number' ? parseFloat(newValue) : newValue;
        } else if (type === 'properties') {
          dashboardData.Properties[idx][field] = inputType === 'number' ? parseFloat(newValue) : newValue;
        } else if (type === 'otherassets') {
          dashboardData.OtherAssets[idx][field] = inputType === 'number' ? parseFloat(newValue) : newValue;
        } else if (type === 'insurance') {
          dashboardData.Insurance[idx][field] = inputType === 'number' ? parseFloat(newValue) : newValue;
        } else if (type === 'land') {
          dashboardData.LandAssets[idx][field] = newValue;
        }
        setStatus('Value updated. Click Save to Cloud to sync.');
        redrawDashboard();
      } else {
        input.replaceWith(span);
      }
    };
    input.onkeydown = function(ev) {
      if (ev.key === 'Enter') {
        input.blur();
      } else if (ev.key === 'Escape') {
        input.replaceWith(span);
      }
    };
  }
});
