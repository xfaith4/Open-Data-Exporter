# Open Data Exporter

The Open Data Exporter is a configurable node.js service that executes PureCloud API requests, performs data calculations and transformations, and exports the data into templates.

## 🚀 Quick Start

### GUI Mode (Recommended)

The GUI provides an intuitive web interface to configure and execute data export jobs without needing to edit configuration files manually.

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Launch the GUI:**
   ```bash
   npm start
   ```
   
   The application will automatically open in your default browser at `http://localhost:3000`

3. **Configure and run:**
   - Load an example configuration or create a new one
   - Enter your PureCloud Client ID, Client Secret, and Environment
   - Select jobs to execute
   - Click "Execute Selected Jobs" or "Execute All Jobs"

**GUI Features:**
- 📁 Load example configurations or create new ones
- 🔐 Manage PureCloud credentials (Client ID, Secret, Environment)
- 📋 View and select jobs from configurations
- ▶️ Execute jobs with a single click
- 📊 Real-time execution feedback
- 💾 Save configuration changes
- 🎨 Professional, responsive design

### Command Line Mode

You can still use the traditional command line interface:

1. Create a [config file] or use one of the [example config files](https://github.com/xfaith4/Open-Data-Exporter/tree/master/src/examples).
2. Be sure to set the client ID, client secret, and environment in the config file, or use the [command line parameters](https://github.com/xfaith4/Open-Data-Exporter/wiki/Running-the-application) to pass the ID and secret in at runtime.
3. Execute jobs: 
   ```bash
   node ./src /clientId=$GENESYSCLOUD_CLIENT_ID /clientSecret=$GENESYSCLOUD_CLIENT_SECRET /config=./examples/abandon_report/config.json /jobs=abandons_job /runnow
   ```
   
   **Note:** Config paths in CLI mode are relative to the `src` directory, so use `./examples/...` instead of `./src/examples/...`

#### CLI Convenience flags

* **List jobs:** `node ./src /config=./examples/abandon_report/config.json /listjobs`
* **Run jobs immediately (one-shot):** `node ./src /config=./examples/abandon_report/config.json /runnow` (runs all jobs unless `/jobs=...` is specified)

# Features

* Robust templating support powered by [doT](http://olado.github.io/doT/)
* Make PureCloud Platform API requests without writing any code
* All post-processing data calculations are fully configurable and programmable
* Ability to execute multiple queries and multiple transformations and use the resulting data in one or more templates
* Write output to dynamically determined locations and files

## Included Configurations

Configuration files can be found in [src/examples](https://github.com/xfaith4/Open-Data-Exporter/tree/master/src/examples).

* abandon_report
  * Abandon Report - Produces a flat text file with a list of calls abandoned in queue
* call_detail_report
  * Call Detail Report - Produces a HTML file with a list of ACD calls occurring within the interval
* presence_report
  * Presence Report - Produces a HTML file with presence and routing status events per user for all users in the org
* verint
  * Verint Agent Scorecard Report - Produces a flat text file with agent scorecard data in the standard Verint format
* daily_conversation_report_card
  * Daily Conversation Report Card - Produces a single-page HTML “report card” (totals + worst queues + recent abandons)
