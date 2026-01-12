#!/usr/bin/env node

/**
 * Open Data Exporter GUI Launcher
 * Main entry point for the application with web-based GUI
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const rateLimit = require('express-rate-limit');
const app = express();

// Rate limiting middleware to prevent abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'gui')));

const PORT = process.env.PORT || 3000;

// Store for running processes
let runningProcesses = {};

// API Routes

// Get configuration
app.get('/api/config', (req, res) => {
    const configPath = req.query.path || './src/config.json';
    try {
        const fullPath = path.join(__dirname, configPath);
        if (fs.existsSync(fullPath)) {
            const config = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            res.json({ success: true, config, path: configPath });
        } else {
            res.status(404).json({ success: false, error: 'Configuration file not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save configuration
app.post('/api/config', (req, res) => {
    const { path: configPath, config } = req.body;
    try {
        const fullPath = path.join(__dirname, configPath || './src/config.json');
        fs.writeFileSync(fullPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Configuration saved successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// List available example configurations
app.get('/api/examples', (req, res) => {
    try {
        const examplesDir = path.join(__dirname, 'src', 'examples');
        const examples = [];
        
        if (fs.existsSync(examplesDir)) {
            const dirs = fs.readdirSync(examplesDir);
            dirs.forEach(dir => {
                const configPath = path.join(examplesDir, dir, 'config.json');
                if (fs.existsSync(configPath)) {
                    // Format the display name: remove underscores and capitalize words
                    const displayName = dir
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    examples.push({
                        name: displayName,
                        path: `./src/examples/${dir}/config.json`
                    });
                }
            });
        }
        
        res.json({ success: true, examples });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// List jobs from configuration
app.post('/api/jobs/list', (req, res) => {
    const { config } = req.body;
    try {
        const jobs = config.jobs || {};
        const jobList = Object.keys(jobs).map(key => ({
            key,
            name: jobs[key].name || key,
            cron: jobs[key].cron || 'no-cron'
        }));
        res.json({ success: true, jobs: jobList });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Execute job(s)
app.post('/api/jobs/execute', (req, res) => {
    const { configPath, jobs, clientId, clientSecret, environment } = req.body;
    
    try {
        const args = ['./src'];
        
        if (clientId) args.push(`/clientId=${clientId}`);
        if (clientSecret) args.push(`/clientSecret=${clientSecret}`);
        if (configPath) args.push(`/config=${configPath}`);
        if (jobs && jobs.length > 0) args.push(`/jobs=${jobs.join(',')}`);
        args.push('/runnow');
        
        const processId = Date.now().toString();
        let output = '';
        
        const child = spawn('node', args, {
            cwd: __dirname,
            env: { ...process.env }
        });
        
        child.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            output += data.toString();
        });
        
        child.on('close', (code) => {
            delete runningProcesses[processId];
        });
        
        runningProcesses[processId] = { child, output: '' };
        
        // Send initial response
        res.json({ 
            success: true, 
            processId,
            message: 'Job execution started' 
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get job execution output
app.get('/api/jobs/output/:processId', (req, res) => {
    const { processId } = req.params;
    const process = runningProcesses[processId];
    
    if (!process) {
        res.json({ success: true, output: '', complete: true });
    } else {
        res.json({ 
            success: true, 
            output: process.output,
            complete: false 
        });
    }
});

// Serve the main GUI page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'gui', 'index.html'));
});

// Start server
app.listen(PORT, async () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           Open Data Exporter - GUI Mode                   ║
║                                                            ║
║  Access the application at: http://localhost:${PORT}       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
    
    // Try to open browser automatically (only if not in headless environment)
    if (process.env.DISPLAY || process.platform === 'win32' || process.platform === 'darwin') {
        try {
            const open = require('open');
            await open(`http://localhost:${PORT}`);
        } catch (error) {
            console.log('\nNote: Could not auto-open browser. Please open your browser and navigate to the URL above.');
        }
    } else {
        console.log('\nPlease open your browser and navigate to the URL above.');
    }
});
