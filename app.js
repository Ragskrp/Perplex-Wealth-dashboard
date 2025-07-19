// Configuration
const CONFIG = {
  SHEET_ID: '1kvXUZ4juDjxRgFODbZw-SCN7J8Qp4fkxN1RuSBTe9SI', // Default sample sheet ID
  WRITE_ENDPOINT: '', // Optional Apps Script POST URL for writes
};

// Sample data as fallback
const SAMPLE_DATA = {
  Bank: [
    { Institution: 'Chase Bank', AccountType: 'Checking', Balance: 15000, InterestRate: '0.01%', LastUpdated: '2025-01-15' },
    { Institution: 'Wells Fargo', AccountType: 'Savings', Balance: 45000, InterestRate: '0.45%', LastUpdated: '2025-01-15' },
    { Institution: 'Ally Bank', AccountType: 'High Yield Savings', Balance: 25000, InterestRate: '4.25%', LastUpdated: '2025-01-15' }
  ],
  Investments: [
    { Asset: 'S&P 500 ETF', Type: 'ETF', Value: 125000, Quantity: 250, Performance: '+12.5%' },
    { Asset: 'Apple Inc.', Type: 'Stock', Value: 45000, Quantity: 250, Performance: '+8.3%' },
    { Asset: 'Bitcoin', Type: 'Cryptocurrency', Value: 15000, Quantity: 0.35, Performance: '+45.2%' },
    { Asset: 'Tesla Inc.', Type: 'Stock', Value: 22000, Quantity: 88, Performance: '-5.1%' }
  ],
  Properties: [
    { Property: 'Primary Residence', Type: 'Residential', Value: 450000, Location: 'San Francisco, CA', Status: 'Owner Occupied' },
    { Property: 'Rental Property', Type: 'Investment', Value: 320000, Location: 'Austin, TX', Status: 'Rented' }
  ],
  OtherAssets: [
    { Asset: '2022 Tesla Model S', Type: 'Vehicle', Value: 85000, Description: 'Electric sedan', DateAcquired: '2022-03-15' },
    { Asset: 'Jewelry Collection', Type: 'Personal', Value: 12000, Description: 'Wedding rings, watches', DateAcquired: '2020-06-01' },
    { Asset: 'Art Collection', Type: 'Collectible', Value: 35000, Description: 'Modern paintings', DateAcquired: '2021-11-20' }
  ],
  Liabilities: [
    { Liability: 'Primary Mortgage', Type: 'Mortgage', Amount: 280000, InterestRate: '3.25%', DueDate: '2048-03-01' },
    { Liability: 'Rental Property Mortgage', Type: 'Mortgage', Amount: 180000, InterestRate: '3.75%', DueDate: '2045-08-15' },
    { Liability: 'Credit Card', Type: 'Credit Card', Amount: 8500, InterestRate: '18.99%', DueDate: '2025-02-15' },
    { Liability: 'Auto Loan', Type: 'Auto Loan', Amount: 35000, InterestRate: '4.25%', DueDate: '2027-03-15' }
  ],
  Insurance: [
    { Policy: 'Life Insurance', Type: 'Life', Coverage: 500000, Premium: 1200, Expiry: '2026-01-01' },
    { Policy: 'Home Insurance', Type: 'Property', Coverage: 450000, Premium: 2400, Expiry: '2025-12-31' },
    { Policy: 'Auto Insurance', Type: 'Auto', Coverage: 100000, Premium: 1800, Expiry: '2025-08-15' },
    { Policy: 'Health Insurance', Type: 'Health', Coverage: 2000000, Premium: 4800, Expiry: '2025-12-31' }
  ]
};

// Global data store
let dashboardData = { ...SAMPLE_DATA };
let allocationChart = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async function() {
  // Start with sample data immediately
  dashboardData = { ...SAMPLE_DATA };
  updateDashboard();
  setupEventListeners();
  
  // Then try to load from sheets
  await loadData();
  updateDashboard();
});

// Event listeners
function setupEventListeners() {
  // Settings modal
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('settingsModal');
    });
  }
  
  // Add modal
  const addBtn = document.getElementById('addBtn');
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('addModal');
      updateAddForm();
    });
  }
  
  // Export button
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      exportData();
    });
  }
  
  // Help modal
  const helpBtn = document.getElementById('helpBtn');
  if (helpBtn) {
    helpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('helpModal');
    });
  }
  
  // Tab switching
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = e.target.getAttribute('data-tab');
      if (tabName) {
        switchTab(tabName);
      }
    });
  });
  
  // Initialize settings inputs
  const sheetIdInput = document.getElementById('sheetIdInput');
  const writeEndpointInput = document.getElementById('writeEndpointInput');
  
  if (sheetIdInput) sheetIdInput.value = CONFIG.SHEET_ID;
  if (writeEndpointInput) writeEndpointInput.value = CONFIG.WRITE_ENDPOINT;
}

// Google Sheets data fetching
async function fetchSheetData(sheetId, tabName) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${tabName}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    // Remove the wrapper to get valid JSON
    const jsonText = text.replace(/.*?google\.visualization\.Query\.setResponse\((.*)\);?\s*$/, '$1');
    const data = JSON.parse(jsonText);
    
    if (data.status === 'error') {
      throw new Error(data.errors[0].detailed_message);
    }
    
    return parseSheetData(data);
  } catch (error) {
    console.warn(`Failed to fetch ${tabName} from sheet:`, error);
    return null;
  }
}

function parseSheetData(data) {
  if (!data.table || !data.table.rows) return [];
  
  const cols = data.table.cols.map(col => col.label || '');
  const rows = data.table.rows;
  
  return rows.map(row => {
    const item = {};
    row.c.forEach((cell, index) => {
      if (cols[index]) {
        item[cols[index]] = cell ? (cell.v || '') : '';
      }
    });
    return item;
  }).filter(item => Object.values(item).some(value => value !== ''));
}

async function loadData() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.classList.remove('hidden');
  }
  
  try {
    const sheetTabs = ['Bank', 'Investments', 'Properties', 'OtherAssets', 'Liabilities', 'Insurance'];
    const promises = sheetTabs.map(tab => fetchSheetData(CONFIG.SHEET_ID, tab));
    const results = await Promise.all(promises);
    
    let hasValidData = false;
    results.forEach((data, index) => {
      if (data && data.length > 0) {
        dashboardData[sheetTabs[index]] = data;
        hasValidData = true;
      }
    });
    
    if (!hasValidData) {
      console.log('No valid data from sheets, using sample data');
      dashboardData = { ...SAMPLE_DATA };
    }
    
  } catch (error) {
    console.error('Error loading sheet data:', error);
    dashboardData = { ...SAMPLE_DATA };
  } finally {
    if (loadingIndicator) {
      loadingIndicator.classList.add('hidden');
    }
  }
}

// Dashboard updates
function updateDashboard() {
  updateSummaryCards();
  updateAllocationChart();
  updateTables();
}

function updateSummaryCards() {
  // Calculate totals
  const bankTotal = dashboardData.Bank.reduce((sum, item) => sum + parseFloat(item.Balance || 0), 0);
  const investmentsTotal = dashboardData.Investments.reduce((sum, item) => sum + parseFloat(item.Value || 0), 0);
  const propertiesTotal = dashboardData.Properties.reduce((sum, item) => sum + parseFloat(item.Value || 0), 0);
  const otherTotal = dashboardData.OtherAssets.reduce((sum, item) => sum + parseFloat(item.Value || 0), 0);
  const liabilitiesTotal = dashboardData.Liabilities.reduce((sum, item) => sum + parseFloat(item.Amount || 0), 0);
  const insuranceTotal = dashboardData.Insurance.reduce((sum, item) => sum + parseFloat(item.Coverage || 0), 0);
  
  const totalAssets = bankTotal + investmentsTotal + propertiesTotal + otherTotal;
  const netWorth = totalAssets - liabilitiesTotal;
  
  // Update DOM
  const totalAssetsEl = document.getElementById('totalAssets');
  const totalLiabilitiesEl = document.getElementById('totalLiabilities');
  const netWorthEl = document.getElementById('netWorth');
  const insuranceCoverageEl = document.getElementById('insuranceCoverage');
  
  if (totalAssetsEl) totalAssetsEl.textContent = formatCurrency(totalAssets);
  if (totalLiabilitiesEl) totalLiabilitiesEl.textContent = formatCurrency(liabilitiesTotal);
  if (netWorthEl) netWorthEl.textContent = formatCurrency(netWorth);
  if (insuranceCoverageEl) insuranceCoverageEl.textContent = formatCurrency(insuranceTotal);
  
  // Update change indicators (placeholder values)
  const assetsChangeEl = document.getElementById('assetsChange');
  const liabilitiesChangeEl = document.getElementById('liabilitiesChange');
  const netWorthChangeEl = document.getElementById('netWorthChange');
  const insuranceChangeEl = document.getElementById('insuranceChange');
  
  if (assetsChangeEl) assetsChangeEl.textContent = '+5.2%';
  if (liabilitiesChangeEl) liabilitiesChangeEl.textContent = '-2.1%';
  if (netWorthChangeEl) netWorthChangeEl.textContent = '+7.3%';
  if (insuranceChangeEl) insuranceChangeEl.textContent = 'Active';
}

function updateAllocationChart() {
  const ctx = document.getElementById('allocationChart');
  if (!ctx) return;
  
  const context = ctx.getContext('2d');
  
  if (allocationChart) {
    allocationChart.destroy();
  }
  
  const bankTotal = dashboardData.Bank.reduce((sum, item) => sum + parseFloat(item.Balance || 0), 0);
  const investmentsTotal = dashboardData.Investments.reduce((sum, item) => sum + parseFloat(item.Value || 0), 0);
  const propertiesTotal = dashboardData.Properties.reduce((sum, item) => sum + parseFloat(item.Value || 0), 0);
  const otherTotal = dashboardData.OtherAssets.reduce((sum, item) => sum + parseFloat(item.Value || 0), 0);
  
  const data = {
    labels: ['Bank Accounts', 'Investments', 'Properties', 'Other Assets'],
    datasets: [{
      data: [bankTotal, investmentsTotal, propertiesTotal, otherTotal],
      backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#5D878F'],
      borderWidth: 2,
      borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-surface')
    }]
  };
  
  allocationChart = new Chart(context, {
    type: 'doughnut',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true
          }
        }
      }
    }
  });
}

function updateTables() {
  updateTable('bankTable', dashboardData.Bank, ['Institution', 'AccountType', 'Balance', 'InterestRate', 'LastUpdated']);
  updateTable('investmentsTable', dashboardData.Investments, ['Asset', 'Type', 'Value', 'Quantity', 'Performance']);
  updateTable('propertiesTable', dashboardData.Properties, ['Property', 'Type', 'Value', 'Location', 'Status']);
  updateTable('otherTable', dashboardData.OtherAssets, ['Asset', 'Type', 'Value', 'Description', 'DateAcquired']);
  updateTable('liabilitiesTable', dashboardData.Liabilities, ['Liability', 'Type', 'Amount', 'InterestRate', 'DueDate']);
  updateTable('insuranceTable', dashboardData.Insurance, ['Policy', 'Type', 'Coverage', 'Premium', 'Expiry']);
}

function updateTable(tableId, data, columns) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  data.forEach(item => {
    const row = document.createElement('tr');
    columns.forEach(col => {
      const cell = document.createElement('td');
      let value = item[col] || '';
      
      // Format currency fields
      if (['Balance', 'Value', 'Amount', 'Coverage', 'Premium'].includes(col)) {
        value = formatCurrency(parseFloat(value) || 0);
      }
      
      cell.textContent = value;
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });
}

// Modal functions - Make global
window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
  }
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
};

// Settings functions - Make global
window.reloadData = async function() {
  const sheetIdInput = document.getElementById('sheetIdInput');
  const writeEndpointInput = document.getElementById('writeEndpointInput');
  
  CONFIG.SHEET_ID = sheetIdInput ? sheetIdInput.value : CONFIG.SHEET_ID;
  CONFIG.WRITE_ENDPOINT = writeEndpointInput ? writeEndpointInput.value : '';
  
  await loadData();
  updateDashboard();
  closeModal('settingsModal');
};

// Add item functionality - Make global
window.updateAddForm = function() {
  const categorySelect = document.getElementById('categorySelect');
  if (!categorySelect) return;
  
  const category = categorySelect.value;
  const fieldsContainer = document.getElementById('addFormFields');
  
  if (!fieldsContainer) return;
  
  const formConfigs = {
    bank: [
      { name: 'Institution', type: 'text', required: true },
      { name: 'AccountType', type: 'text', required: true },
      { name: 'Balance', type: 'number', required: true },
      { name: 'InterestRate', type: 'text', required: false },
      { name: 'LastUpdated', type: 'date', required: true }
    ],
    investments: [
      { name: 'Asset', type: 'text', required: true },
      { name: 'Type', type: 'text', required: true },
      { name: 'Value', type: 'number', required: true },
      { name: 'Quantity', type: 'number', required: true },
      { name: 'Performance', type: 'text', required: false }
    ],
    properties: [
      { name: 'Property', type: 'text', required: true },
      { name: 'Type', type: 'text', required: true },
      { name: 'Value', type: 'number', required: true },
      { name: 'Location', type: 'text', required: true },
      { name: 'Status', type: 'text', required: true }
    ],
    other: [
      { name: 'Asset', type: 'text', required: true },
      { name: 'Type', type: 'text', required: true },
      { name: 'Value', type: 'number', required: true },
      { name: 'Description', type: 'text', required: false },
      { name: 'DateAcquired', type: 'date', required: true }
    ],
    liabilities: [
      { name: 'Liability', type: 'text', required: true },
      { name: 'Type', type: 'text', required: true },
      { name: 'Amount', type: 'number', required: true },
      { name: 'InterestRate', type: 'text', required: false },
      { name: 'DueDate', type: 'date', required: true }
    ],
    insurance: [
      { name: 'Policy', type: 'text', required: true },
      { name: 'Type', type: 'text', required: true },
      { name: 'Coverage', type: 'number', required: true },
      { name: 'Premium', type: 'number', required: true },
      { name: 'Expiry', type: 'date', required: true }
    ]
  };
  
  const fields = formConfigs[category] || [];
  fieldsContainer.innerHTML = '';
  
  fields.forEach(field => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = field.name + (field.required ? ' *' : '');
    
    const input = document.createElement('input');
    input.type = field.type;
    input.className = 'form-control';
    input.id = `add${field.name}`;
    input.required = field.required;
    
    if (field.type === 'date') {
      input.value = dayjs().format('YYYY-MM-DD');
    }
    
    formGroup.appendChild(label);
    formGroup.appendChild(input);
    fieldsContainer.appendChild(formGroup);
  });
};

window.addItem = async function() {
  const categorySelect = document.getElementById('categorySelect');
  if (!categorySelect) return;
  
  const category = categorySelect.value;
  const formData = {};
  
  // Collect form data
  const inputs = document.querySelectorAll('#addFormFields input');
  inputs.forEach(input => {
    const fieldName = input.id.replace('add', '');
    formData[fieldName] = input.value;
  });
  
  // Validate required fields
  const requiredFields = Array.from(inputs).filter(input => input.required);
  const isValid = requiredFields.every(input => input.value.trim() !== '');
  
  if (!isValid) {
    alert('Please fill in all required fields');
    return;
  }
  
  // Add to local data
  const categoryMap = {
    bank: 'Bank',
    investments: 'Investments',
    properties: 'Properties',
    other: 'OtherAssets',
    liabilities: 'Liabilities',
    insurance: 'Insurance'
  };
  
  const dataCategory = categoryMap[category];
  dashboardData[dataCategory].push(formData);
  
  // Try to write to sheet if endpoint is configured
  if (CONFIG.WRITE_ENDPOINT) {
    try {
      await fetch(CONFIG.WRITE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tab: dataCategory,
          row: formData
        })
      });
      console.log('Data written to sheet successfully');
    } catch (error) {
      console.error('Failed to write to sheet:', error);
    }
  } else {
    console.log('No write endpoint configured - data stored locally only');
  }
  
  // Update dashboard and close modal
  updateDashboard();
  closeModal('addModal');
};

// Tab switching
function switchTab(tabName) {
  if (!tabName) return;
  
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }
  
  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
  
  const tabMap = {
    bank: 'bankTab',
    investments: 'investmentsTab',
    properties: 'propertiesTab',
    other: 'otherTab',
    liabilities: 'liabilitiesTab',
    insurance: 'insuranceTab'
  };
  
  const targetTab = document.getElementById(tabMap[tabName]);
  if (targetTab) {
    targetTab.classList.add('active');
  }
}

// Export functionality
function exportData() {
  const exportData = {
    exportDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    data: dashboardData
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-dashboard-${dayjs().format('YYYY-MM-DD')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Utility functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}