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

let currentUser = null;
let spendingChart = null;
let assetsChart = null;

// UI Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard');
const statusSpan = document.getElementById('status');
const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const welcomeMsg = document.getElementById('welcome-msg');

// Dashboard data structure
let dashboardData = {
  Bank: [], 
  Investments: [], 
  Properties: [], 
  OtherAssets: [],
  Liabilities: [], 
  Insurance: []
};

// Initialize current date
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options);
});

function setStatus(msg) { 
  statusSpan.textContent = msg; 
  setTimeout(() => statusSpan.textContent = '', 3000);
}

// Show/hide dashboard sections
function updateDashboardVisibility(show) {
  authSection.style.display = show ? 'none' : 'flex';
  dashboardSection.style.display = show ? 'block' : 'none';
}

function updateAuthUI(user) {
  if (user) {
    welcomeMsg.textContent = `Welcome, ${user.email}`;
    signInBtn.style.display = 'none';
    signOutBtn.style.display = 'block';
    
    // Update user info in header
    document.getElementById('user-name').textContent = user.displayName || user.email.split('@')[0];
    document.getElementById('user-avatar').src = user.photoURL || `https://ui-avatars.com/api/?name=${user.email}&background=3b82f6&color=fff`;
    document.getElementById('user-info').style.display = 'flex';
    
    updateDashboardVisibility(true);
  } else {
    welcomeMsg.textContent = 'Please sign in to access your dashboard';
    signInBtn.style.display = 'block';
    signOutBtn.style.display = 'none';
    document.getElementById('user-info').style.display = 'none';
    updateDashboardVisibility(false);
  }
}

// Auth event handlers
signInBtn.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(e => setStatus("Sign-in failed: " + e.message));
};

signOutBtn.onclick = () => auth.signOut();

// Auth state listener
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

// Firestore operations
function userDocKey() {
  if (!currentUser) throw new Error("No user signed in");
  return "dashboard_" + currentUser.uid;
}

function saveDashboard() {
  if (!currentUser) return setStatus("Sign in first");
  db.collection('dashboards').doc(userDocKey()).set(dashboardData)
    .then(() => setStatus('Data saved successfully!'))
    .catch((e) => setStatus('Error saving: ' + e.message));
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
        setStatus('Starting with fresh data');
        dashboardData = {
          Bank: [], 
          Investments: [], 
          Properties: [], 
          OtherAssets: [], 
          Liabilities: [], 
          Insurance: []
        };
        redrawDashboard();
      }
    })
    .catch(e => setStatus('Error loading: ' + e.message));
}

function clearDashboard() {
  dashboardData = {
    Bank: [], 
    Investments: [], 
    Properties: [], 
    OtherAssets: [], 
    Liabilities: [], 
    Insurance: []
  };
  redrawDashboard();
}

// Dashboard calculation functions
function sumArr(arr, key) {
  return arr.reduce((sum, item) => sum + Number(item[key] || 0), 0);
}

function fmtMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

function calculateTotals() {
  const bankTotal = sumArr(dashboardData.Bank, 'value');
  const investmentsTotal = sumArr(dashboardData.Investments, 'value');
  const propertiesTotal = sumArr(dashboardData.Properties, 'value');
  const otherAssetsTotal = sumArr(dashboardData.OtherAssets, 'value');
  const liabilitiesTotal = sumArr(dashboardData.Liabilities, 'value');
  const insuranceTotal = sumArr(dashboardData.Insurance, 'value');
  
  const totalAssets = bankTotal + investmentsTotal + propertiesTotal + otherAssetsTotal;
  const availableBalance = bankTotal; // Assuming bank balance is available balance
  const netWorth = totalAssets + insuranceTotal - liabilitiesTotal;
  const totalSpendings = liabilitiesTotal; // Using liabilities as spending proxy
  const totalIncome = totalAssets; // Using assets as income proxy
  
  return {
    availableBalance,
    netWorth,
    totalSpendings,
    totalIncome,
    bankTotal,
    investmentsTotal,
    propertiesTotal,
    otherAssetsTotal,
    liabilitiesTotal,
    insuranceTotal
  };
}

// Update dashboard UI
function redrawDashboard() {
  const totals = calculateTotals();
  
  // Update summary cards
  document.getElementById('availableBalance').textContent = fmtMoney(totals.availableBalance);
  document.getElementById('netWorth').textContent = fmtMoney(totals.netWorth);
  document.getElementById('totalSpendings').textContent = fmtMoney(totals.totalSpendings);
  document.getElementById('totalIncome').textContent = fmtMoney(totals.totalIncome);
  
  // Update goal progress (example: 50k goal)
  const goalAmount = 50000;
  const goalProgress = Math.min((totals.totalIncome / goalAmount) * 100, 100);
  document.getElementById('goalPercentage').textContent = Math.round(goalProgress) + '%';
  document.getElementById('currentIncome').textContent = fmtMoney(totals.totalIncome);
  document.getElementById('goalAmount').textContent = fmtMoney(goalAmount);
  document.getElementById('progressFill').style.width = goalProgress + '%';
  
  // Update income sources
  updateIncomeSources();
  
  // Update charts
  updateCharts();
  
  // Update tables
  updateTables();
}

function updateIncomeSources() {
  const container = document.getElementById('incomeSources');
  container.innerHTML = '';
  
  // Combine all asset types as income sources
  const sources = [
    { name: 'Bank Accounts', amount: sumArr(dashboardData.Bank, 'value') },
    { name: 'Investments', amount: sumArr(dashboardData.Investments, 'value') },
    { name: 'Properties', amount: sumArr(dashboardData.Properties, 'value') },
    { name: 'Other Assets', amount: sumArr(dashboardData.OtherAssets, 'value') }
  ].filter(source => source.amount > 0);
  
  sources.forEach(source => {
    const item = document.createElement('div');
    item.className = 'income-source-item';
    item.innerHTML = `
      <span class="income-source-name">${source.name}</span>
      <span class="income-source-amount">${fmtMoney(source.amount)}</span>
    `;
    container.appendChild(item);
  });
  
  if (sources.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No income sources yet</p>';
  }
}

function updateCharts() {
  updateSpendingChart();
  updateAssetsChart();
}

function updateSpendingChart() {
  const ctx = document.getElementById('spendingDonutChart').getContext('2d');
  
  if (spendingChart) {
    spendingChart.destroy();
  }
  
  // Sample spending categories - in a real app, you'd have these categories in your data
  const spendingData = [
    { label: 'Housing', value: sumArr(dashboardData.Liabilities, 'value') * 0.4, color: '#ef4444' },
    { label: 'Transportation', value: sumArr(dashboardData.Liabilities, 'value') * 0.3, color: '#f59e0b' },
    { label: 'Personal', value: sumArr(dashboardData.Liabilities, 'value') * 0.3, color: '#8b5cf6' }
  ].filter(item => item.value > 0);
  
  if (spendingData.length === 0) {
    document.getElementById('spendingChart').innerHTML = '<p style="color: var(--text-muted); text-align: center;">No spending data yet</p>';
    return;
  }
  
  spendingChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: spendingData.map(item => item.label),
      datasets: [{
        data: spendingData.map(item => item.value),
        backgroundColor: spendingData.map(item => item.color),
        borderWidth: 0,
        cutout: '60%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#f8fafc',
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + fmtMoney(context.parsed);
            }
          }
        }
      }
    }
  });
}

function updateAssetsChart() {
  const ctx = document.getElementById('assetsDonutChart').getContext('2d');
  
  if (assetsChart) {
    assetsChart.destroy();
  }
  
  const assetsData = [
    { label: 'Bank', value: sumArr(dashboardData.Bank, 'value'), color: '#10b981' },
    { label: 'Investments', value: sumArr(dashboardData.Investments, 'value'), color: '#3b82f6' },
    { label: 'Properties', value: sumArr(dashboardData.Properties, 'value'), color: '#8b5cf6' },
    { label: 'Other Assets', value: sumArr(dashboardData.OtherAssets, 'value'), color: '#f59e0b' }
  ].filter(item => item.value > 0);
  
  if (assetsData.length === 0) {
    document.querySelector('.assets-chart').innerHTML = '<p style="color: var(--text-muted); text-align: center;">No assets data yet</p>';
    return;
  }
  
  assetsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: assetsData.map(item => item.label),
      datasets: [{
        data: assetsData.map(item => item.value),
        backgroundColor: assetsData.map(item => item.color),
        borderWidth: 0,
        cutout: '60%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#f8fafc',
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + fmtMoney(context.parsed);
            }
          }
        }
      }
    }
  });
}

function updateTables() {
  // Assets table
  const assetsTbody = document.getElementById('assetsTbody');
  assetsTbody.innerHTML = '';
  
  ['Bank', 'Investments', 'Properties', 'OtherAssets'].forEach(type => {
    dashboardData[type].forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${type}</td>
        <td>${row.name}</td>
        <td>${row.institution || row.provider || '-'}</td>
        <td>${fmtMoney(row.value)}</td>
        <td>${row.currency || 'USD'}</td>
        <td>${row.details || '-'}</td>
      `;
      assetsTbody.appendChild(tr);
    });
  });
  
  // Liabilities table
  const liabilitiesTbody = document.getElementById('liabilitiesTbody');
  liabilitiesTbody.innerHTML = '';
  
  dashboardData.Liabilities.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.name}</td>
      <td>${row.institution}</td>
      <td>${fmtMoney(row.value)}</td>
      <td>${row.currency || 'USD'}</td>
      <td>${row.date || '-'}</td>
    `;
    liabilitiesTbody.appendChild(tr);
  });
  
  // Insurance table
  const insuranceTbody = document.getElementById('insuranceTbody');
  insuranceTbody.innerHTML = '';
  
  dashboardData.Insurance.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.name}</td>
      <td>${row.provider}</td>
      <td>${fmtMoney(row.value)}</td>
      <td>${row.currency || 'USD'}</td>
      <td>${row.details || '-'}</td>
      <td>${row.date || '-'}</td>
    `;
    insuranceTbody.appendChild(tr);
  });
}

// Form handling
document.getElementById('entryForm').onsubmit = function(e) {
  e.preventDefault();
  if (!currentUser) return setStatus("Please sign in first");
  
  const type = document.getElementById('entryType').value;
  const name = document.getElementById('inputName').value.trim();
  const institution = document.getElementById('inputInstitution').value.trim();
  const value = parseFloat(document.getElementById('inputValue').value);
  const currency = document.getElementById('inputCurrency').value.trim() || 'USD';
  const details = document.getElementById('inputDetails').value.trim();
  const date = document.getElementById('inputDate').value;
  
  if (!name || isNaN(value)) return setStatus("Name and valid value are required");
  
  let entry = { name, value, currency };
  
  if (['Bank', 'Investment', 'Property', 'OtherAsset'].includes(type)) {
    entry.institution = institution;
    if (details) entry.details = details;
  }
  
  if (type === 'Liability') {
    entry.institution = institution;
    if (date) entry.date = date;
  }
  
  if (type === 'Insurance') {
    entry.provider = institution;
    if (details) entry.details = details;
    if (date) entry.date = date;
  }
  
  // Map type to data structure key
  const structKey = {
    'Bank': 'Bank',
    'Investment': 'Investments', 
    'Property': 'Properties',
    'OtherAsset': 'OtherAssets',
    'Liability': 'Liabilities',
    'Insurance': 'Insurance'
  }[type];
  
  // Check if entry exists (update) or add new
  const existingIndex = dashboardData[structKey].findIndex(row => row.name === name);
  if (existingIndex >= 0) {
    dashboardData[structKey][existingIndex] = entry;
    setStatus(`Updated ${type}: ${name}`);
  } else {
    dashboardData[structKey].push(entry);
    setStatus(`Added ${type}: ${name}`);
  }
  
  redrawDashboard();
  
  // Clear form
  document.getElementById('entryForm').reset();
};

// Save button
document.getElementById('saveBtn').onclick = saveDashboard;

// Initialize on page load
updateDashboardVisibility(false);
