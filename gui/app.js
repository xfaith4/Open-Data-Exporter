// Application state
let currentConfig = null;
let currentJobs = [];
let oauthAccessToken = null;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    loadExamples();
    loadDefaultConfig();
    setupEventListeners();
    checkStoredToken();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('loadConfigBtn').addEventListener('click', loadSelectedConfig);
    document.getElementById('newConfigBtn').addEventListener('click', createNewConfig);
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfiguration);
    document.getElementById('executeSelectedBtn').addEventListener('click', executeSelectedJobs);
    document.getElementById('executeAllBtn').addEventListener('click', executeAllJobs);
    document.getElementById('exportSummaryBtn').addEventListener('click', exportSummary);
    document.getElementById('clearOutputBtn').addEventListener('click', clearOutput);
    document.getElementById('loginBtn').addEventListener('click', handlePKCELogin);
    document.getElementById('authMethod').addEventListener('change', toggleAuthMethod);
    
    // Auto-update jobs when config changes
    document.getElementById('configPath').addEventListener('change', loadDefaultConfig);
    
    // Listen for OAuth callback messages
    window.addEventListener('message', handleOAuthMessage);
}

// Toggle between authentication methods
function toggleAuthMethod() {
    const authMethod = document.getElementById('authMethod').value;
    const clientSecretGroup = document.getElementById('clientSecretGroup');
    const redirectUriGroup = document.getElementById('redirectUriGroup');
    const loginBtn = document.getElementById('loginBtn');
    const authStatusGroup = document.getElementById('authStatusGroup');
    
    if (authMethod === 'pkce') {
        clientSecretGroup.style.display = 'none';
        redirectUriGroup.style.display = 'block';
        loginBtn.style.display = 'inline-flex';
        authStatusGroup.style.display = 'block';
        updateAuthStatus();
    } else {
        clientSecretGroup.style.display = 'block';
        redirectUriGroup.style.display = 'none';
        loginBtn.style.display = 'none';
        authStatusGroup.style.display = 'none';
    }
}

// Check for stored OAuth token
function checkStoredToken() {
    const token = sessionStorage.getItem('oauth_access_token');
    const timestamp = sessionStorage.getItem('oauth_timestamp');
    const expiresIn = sessionStorage.getItem('oauth_expires_in');
    
    if (token && timestamp && expiresIn) {
        const elapsed = Date.now() - parseInt(timestamp);
        const expiresInMs = parseInt(expiresIn) * 1000;
        
        if (elapsed < expiresInMs) {
            oauthAccessToken = token;
            updateAuthStatus();
        } else {
            // Token expired, clear it
            clearStoredToken();
        }
    }
}

// Clear stored OAuth token
function clearStoredToken() {
    sessionStorage.removeItem('oauth_access_token');
    sessionStorage.removeItem('oauth_token_type');
    sessionStorage.removeItem('oauth_expires_in');
    sessionStorage.removeItem('oauth_timestamp');
    oauthAccessToken = null;
    updateAuthStatus();
}

// Update authentication status display
function updateAuthStatus() {
    const authStatusGroup = document.getElementById('authStatusGroup');
    const authStatus = document.getElementById('authStatus');
    const authMethod = document.getElementById('authMethod').value;
    
    if (authMethod !== 'pkce') {
        return;
    }
    
    if (oauthAccessToken) {
        const timestamp = sessionStorage.getItem('oauth_timestamp');
        const expiresIn = sessionStorage.getItem('oauth_expires_in');
        const elapsed = Date.now() - parseInt(timestamp);
        const expiresInMs = parseInt(expiresIn) * 1000;
        const remainingMs = expiresInMs - elapsed;
        const remainingMins = Math.floor(remainingMs / 60000);
        
        authStatus.innerHTML = `<span style="color: #16a34a;">✓ Authenticated</span> (expires in ${remainingMins} minutes)`;
        authStatusGroup.style.display = 'block';
    } else {
        authStatus.innerHTML = `<span style="color: #dc2626;">✗ Not authenticated</span> - Please log in`;
        authStatusGroup.style.display = 'block';
    }
}

// Handle PKCE login
async function handlePKCELogin() {
    const clientId = document.getElementById('clientId').value;
    const redirectUri = document.getElementById('redirectUri').value || `${window.location.origin}/oauth-callback.html`;
    const environment = document.getElementById('environment').value;
    
    if (!clientId || !environment) {
        showToast('Please provide Client ID and Environment', 'error');
        return;
    }
    
    try {
        // Store redirect URI for callback
        localStorage.setItem('oauth_redirect_uri', redirectUri);
        
        // Get PKCE parameters
        const response = await fetch('/api/oauth/pkce-params', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, redirectUri, environment })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Open OAuth authorization page in popup
            const width = 500;
            const height = 700;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;
            
            const popup = window.open(
                data.authUrl,
                'OAuth Login',
                `width=${width},height=${height},left=${left},top=${top}`
            );
            
            if (!popup) {
                showToast('Popup blocked. Please allow popups for this site.', 'error');
            } else {
                showToast('Login window opened...', 'info');
            }
        } else {
            showToast('Failed to initiate login: ' + data.error, 'error');
        }
    } catch (error) {
        showToast('Error initiating login: ' + error.message, 'error');
    }
}

// Handle OAuth callback message from popup
async function handleOAuthMessage(event) {
    // Verify origin
    if (event.origin !== window.location.origin) {
        return;
    }
    
    if (event.data.type === 'oauth_callback') {
        const { code, state } = event.data;
        const redirectUri = localStorage.getItem('oauth_redirect_uri') || `${window.location.origin}/oauth-callback.html`;
        
        try {
            // Exchange code for token
            const response = await fetch('/api/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, state, redirectUri })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Store token
                oauthAccessToken = data.accessToken;
                sessionStorage.setItem('oauth_access_token', data.accessToken);
                sessionStorage.setItem('oauth_token_type', data.tokenType);
                sessionStorage.setItem('oauth_expires_in', data.expiresIn);
                sessionStorage.setItem('oauth_timestamp', Date.now());
                
                updateAuthStatus();
                showToast('Successfully authenticated!', 'success');
            } else {
                showToast('Token exchange failed: ' + data.error, 'error');
            }
        } catch (error) {
            showToast('Error exchanging token: ' + error.message, 'error');
        }
    } else if (event.data.type === 'oauth_error') {
        showToast('OAuth error: ' + (event.data.errorDescription || event.data.error), 'error');
    }
}

// Load available example configurations
async function loadExamples() {
    try {
        const response = await fetch('/api/examples');
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('configSelect');
            data.examples.forEach(example => {
                const option = document.createElement('option');
                option.value = example.path;
                option.textContent = example.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        showToast('Failed to load examples: ' + error.message, 'error');
    }
}

// Load selected configuration from dropdown
async function loadSelectedConfig() {
    const select = document.getElementById('configSelect');
    const configPath = select.value;
    
    if (!configPath) {
        showToast('Please select a configuration', 'error');
        return;
    }
    
    document.getElementById('configPath').value = configPath;
    await loadDefaultConfig();
}

// Load default or specified configuration
async function loadDefaultConfig() {
    const configPath = document.getElementById('configPath').value;
    
    try {
        const response = await fetch(`/api/config?path=${encodeURIComponent(configPath)}`);
        const data = await response.json();
        
        if (data.success) {
            currentConfig = data.config;
            populateConfigForm(data.config);
            await loadJobs(data.config);
            showToast('Configuration loaded successfully', 'info');
        } else {
            showToast('Failed to load configuration: ' + data.error, 'error');
        }
    } catch (error) {
        showToast('Error loading configuration: ' + error.message, 'error');
    }
}

// Create new empty configuration
function createNewConfig() {
    currentConfig = {
        purecloud: {
            clientId: "",
            clientSecret: "",
            redirectUri: "",
            timeout: 10000,
            environment: ""
        },
        requests: {},
        transforms: {},
        templates: {},
        exports: {},
        configurations: {},
        jobs: {},
        customData: {}
    };
    
    populateConfigForm(currentConfig);
    document.getElementById('jobsList').innerHTML = '<div class="loading">No jobs configured</div>';
    showToast('New configuration created', 'info');
}

// Populate form with configuration data
function populateConfigForm(config) {
    if (config.purecloud || config.pureCloud) {
        const pc = config.purecloud || config.pureCloud;
        document.getElementById('clientId').value = pc.clientId || '';
        document.getElementById('clientSecret').value = pc.clientSecret || '';
        document.getElementById('redirectUri').value = pc.redirectUri || '';
        document.getElementById('environment').value = pc.environment || '';
        document.getElementById('timeout').value = pc.timeout || 10000;
        
        // Set default redirect URI if not set
        if (!pc.redirectUri) {
            document.getElementById('redirectUri').value = `${window.location.origin}/oauth-callback.html`;
        }
    }
}

// Load and display jobs
async function loadJobs(config) {
    try {
        const response = await fetch('/api/jobs/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentJobs = data.jobs;
            displayJobs(data.jobs);
        } else {
            document.getElementById('jobsList').innerHTML = '<div class="loading">Failed to load jobs</div>';
        }
    } catch (error) {
        document.getElementById('jobsList').innerHTML = '<div class="loading">Error loading jobs</div>';
    }
}

// Display jobs in the UI
function displayJobs(jobs) {
    const jobsList = document.getElementById('jobsList');
    
    if (jobs.length === 0) {
        jobsList.innerHTML = '<div class="loading">No jobs found in configuration</div>';
        return;
    }
    
    jobsList.innerHTML = jobs.map(job => `
        <div class="job-item">
            <input type="checkbox" id="job-${job.key}" value="${job.key}">
            <div class="job-details">
                <div class="job-name">${job.name}</div>
                <div class="job-meta">Key: ${job.key} | Schedule: ${job.cron}</div>
            </div>
        </div>
    `).join('');
}

// Save configuration
async function saveConfiguration() {
    if (!currentConfig) {
        showToast('No configuration loaded', 'error');
        return;
    }
    
    // Update config with form values
    const pc = currentConfig.purecloud || currentConfig.pureCloud || {};
    pc.clientId = document.getElementById('clientId').value;
    pc.clientSecret = document.getElementById('clientSecret').value;
    pc.redirectUri = document.getElementById('redirectUri').value;
    pc.environment = document.getElementById('environment').value;
    pc.timeout = parseInt(document.getElementById('timeout').value) || 10000;
    
    if (currentConfig.purecloud) {
        currentConfig.purecloud = pc;
    } else {
        currentConfig.pureCloud = pc;
    }
    
    const configPath = document.getElementById('configPath').value;
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: configPath, config: currentConfig })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Configuration saved successfully!', 'success');
        } else {
            showToast('Failed to save configuration: ' + data.error, 'error');
        }
    } catch (error) {
        showToast('Error saving configuration: ' + error.message, 'error');
    }
}

// Execute selected jobs
async function executeSelectedJobs() {
    const selected = getSelectedJobs();
    
    if (selected.length === 0) {
        showToast('Please select at least one job', 'error');
        return;
    }
    
    await executeJobs(selected);
}

// Execute all jobs
async function executeAllJobs() {
    const allJobs = currentJobs.map(job => job.key);
    
    if (allJobs.length === 0) {
        showToast('No jobs available to execute', 'error');
        return;
    }
    
    await executeJobs(allJobs);
}

// Get selected job keys
function getSelectedJobs() {
    const checkboxes = document.querySelectorAll('#jobsList input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Execute jobs
async function executeJobs(jobKeys) {
    const clientId = document.getElementById('clientId').value;
    const clientSecret = document.getElementById('clientSecret').value;
    const environment = document.getElementById('environment').value;
    const configPath = document.getElementById('configPath').value;
    
    if (!clientId || !clientSecret) {
        showToast('Please provide Client ID and Client Secret', 'error');
        return;
    }
    
    const outputBox = document.getElementById('executionOutput');
    outputBox.innerHTML = '<div class="output-placeholder">Executing jobs...</div>';
    
    showToast('Starting job execution...', 'info');
    
    try {
        const response = await fetch('/api/jobs/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                configPath,
                jobs: jobKeys,
                clientId,
                clientSecret,
                environment
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Jobs started successfully', 'success');
            outputBox.innerHTML = `<div style="color: #10b981;">✓ Job execution initiated</div>
<div style="color: #94a3b8;">Jobs: ${jobKeys.join(', ')}</div>
<div style="color: #94a3b8;">Process ID: ${data.processId}</div>
<div style="margin-top: 1rem; color: #94a3b8;">Check the application logs in the terminal for detailed output.</div>`;
        } else {
            showToast('Failed to execute jobs: ' + data.error, 'error');
            outputBox.innerHTML = `<div style="color: #ef4444;">✗ Error: ${data.error}</div>`;
        }
    } catch (error) {
        showToast('Error executing jobs: ' + error.message, 'error');
        outputBox.innerHTML = `<div style="color: #ef4444;">✗ Error: ${error.message}</div>`;
    }
}

// Clear output
function clearOutput() {
    document.getElementById('executionOutput').innerHTML = '<div class="output-placeholder">Execution output will appear here...</div>';
}

// Export summary
function exportSummary() {
    if (!currentConfig || !currentJobs || currentJobs.length === 0) {
        showToast('No configuration or jobs loaded to export', 'error');
        return;
    }

    const configPath = document.getElementById('configPath').value;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    
    // Create summary text content
    let summaryText = 'GENESYS CLOUD DATA EXPORTER - CONFIGURATION SUMMARY\n';
    summaryText += '='.repeat(60) + '\n\n';
    summaryText += `Export Date: ${new Date().toLocaleString()}\n`;
    summaryText += `Configuration Path: ${configPath}\n\n`;
    
    summaryText += 'CREDENTIALS\n';
    summaryText += '-'.repeat(60) + '\n';
    summaryText += `Client ID: ${document.getElementById('clientId').value || 'Not set'}\n`;
    summaryText += `Environment: ${document.getElementById('environment').value || 'Not set'}\n`;
    summaryText += `Timeout: ${document.getElementById('timeout').value || '10000'} ms\n\n`;
    
    summaryText += 'JOBS\n';
    summaryText += '-'.repeat(60) + '\n';
    currentJobs.forEach((job, index) => {
        summaryText += `${index + 1}. ${job.name}\n`;
        summaryText += `   Key: ${job.key}\n`;
        summaryText += `   Schedule: ${job.cron}\n\n`;
    });
    
    summaryText += 'CONFIGURATION SUMMARY\n';
    summaryText += '-'.repeat(60) + '\n';
    summaryText += `Total Jobs: ${currentJobs.length}\n`;
    summaryText += `Total Requests: ${Object.keys(currentConfig.requests || {}).length}\n`;
    summaryText += `Total Transforms: ${Object.keys(currentConfig.transforms || {}).length}\n`;
    summaryText += `Total Templates: ${Object.keys(currentConfig.templates || {}).length}\n`;
    summaryText += `Total Exports: ${Object.keys(currentConfig.exports || {}).length}\n\n`;
    
    summaryText += '='.repeat(60) + '\n';
    summaryText += 'End of Summary\n';
    
    // Create and download the file
    try {
        const blob = new Blob([summaryText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `genesys-cloud-config-summary-${timestamp}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('Summary exported successfully!', 'success');
    } catch (error) {
        showToast('Failed to export summary: ' + error.message, 'error');
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
