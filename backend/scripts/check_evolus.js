// backend/scripts/check_evolus.js
// Verification script for Evolus REST API credentials. Owned by Ammar

require('dotenv').config();
const { checkHealth } = require('../src/services/evolusClient');

async function checkEvolus() {
  console.log('====================================================');
  console.log('Evolus REST API Connectivity & Credential Check');
  console.log('====================================================');
  const baseUrl = process.env.EVOLUS_BASE_URL || 'https://api.evolus.ai/api/v1';
  const mode = (process.env.EVOLUS_MODE || 'mock').toLowerCase();

  console.log(`Base URL       : ${baseUrl}`);
  console.log(`Mode           : ${mode.toUpperCase()}`);
  console.log(`App ID         : ${process.env.EVOLUS_APPLICATION_ID || '(not set)'}`);
  console.log(`API Key        : ${process.env.EVOLUS_API_KEY ? 'Present (***' + process.env.EVOLUS_API_KEY.slice(-4) + ')' : '(not set)'}`);
  console.log('----------------------------------------------------');

  try {
    process.stdout.write('Checking Evolus API connectivity... ');
    const t0 = Date.now();
    const result = await checkHealth();
    const latency = Date.now() - t0;

    console.log('[OK]');
    console.log(`  Latency : ${latency} ms`);
    console.log(`  Result  : ${JSON.stringify(result)}`);
    console.log('----------------------------------------------------');
    console.log('OVERALL STATUS: [PASS] - Evolus integration is ready.');
    process.exit(0);
  } catch (err) {
    console.log('[FAIL]');
    console.error(`  Error: ${err.message}`);
    console.log('----------------------------------------------------');
    console.log('OVERALL STATUS: [FAIL] - Check EVOLUS_BASE_URL and EVOLUS_API_KEY.');
    process.exit(1);
  }
}

if (require.main === module) {
  checkEvolus();
}

module.exports = { checkEvolus };
