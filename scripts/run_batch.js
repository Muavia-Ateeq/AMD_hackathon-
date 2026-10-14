// scripts/run_batch.js
// Utility to upload all PDF documents in /data/documents to the backend, wait for processing,
// and record the results. Designed for mock mode and limited‑credit runs.

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// ---------- Configuration ----------
const DEFAULT_LIMIT = 10; // safe default for credit‑limited runs
const POLL_INTERVAL_MS = 5000; // poll every 5 seconds
const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes per document
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const DATA_DIR = path.resolve(__dirname, '..', 'data', 'documents');
const RESULTS_PATH = path.resolve(__dirname, '..', 'backend', 'metrics', 'batch_results.json');

// ---------- Helper functions ----------
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: null, resume: false, all: false };
  args.forEach((arg, i) => {
    if (arg === '--limit' && args[i + 1]) opts.limit = parseInt(args[i + 1], 10);
    if (arg === '--resume') opts.resume = true;
    if (arg === '--all') opts.all = true;
  });
  return opts;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadDocument(filePath, fileName) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), fileName);
  // optional fields can be provided; defaults are fine for mock mode
  const response = await axios.post(`${BACKEND_URL}/api/documents`, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });
  return response.data; // { id, status }
}

async function pollDocument(id) {
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    const res = await axios.get(`${BACKEND_URL}/api/documents/${id}`);
    const doc = res.data;
    if (doc.status && doc.status !== 'processing') {
      return doc;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timeout while waiting for document processing');
}

async function main() {
  const opts = parseArgs();
  // Load existing results if resuming
  let existingResults = [];
  if (opts.resume && fs.existsSync(RESULTS_PATH)) {
    existingResults = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
  }
  const processedFiles = new Set(existingResults.map(r => r.fileName));

  const allFiles = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  let filesToProcess = allFiles.filter(f => !processedFiles.has(f));

  if (!opts.all) {
    const limit = opts.limit != null ? opts.limit : DEFAULT_LIMIT;
    if (limit > DEFAULT_LIMIT && !opts.all) {
      console.warn(`⚠️  Limit ${limit} exceeds safe default (${DEFAULT_LIMIT}). Use --all to process more.`);
    }
    filesToProcess = filesToProcess.slice(0, limit);
  }

  console.log(`🚀 Processing ${filesToProcess.length} document(s)...`);

  const results = [...existingResults];
  const concurrency = parseInt(process.argv[process.argv.indexOf('--limit') + 1] || 3, 10);
  const limit = concurrency > 0 ? concurrency : 3;

  let active = 0;
  let index = 0;
  const summary = { counts: {}, totalMs: 0, processed: 0 };

  async function worker() {
    while (index < filesToProcess.length) {
      const fileName = filesToProcess[index++];
      const filePath = path.join(DATA_DIR, fileName);
      try {
        console.log(`📤 Uploading ${fileName}...`);
        const uploadRes = await uploadDocument(filePath, fileName);
        const doc = await pollDocument(uploadRes.id);
        const record = {
          fileName,
          id: doc.id,
          status: doc.status,
          extracted: doc.extracted,
          issues: doc.issues,
          explanation: doc.explanation,
          timing: doc.timing
        };
        results.push(record);
        // Update summary
        summary.counts[doc.status] = (summary.counts[doc.status] || 0) + 1;
        if (doc.timing && typeof doc.timing.totalMs === 'number') {
          summary.totalMs += doc.timing.totalMs;
        }
        summary.processed++;
        console.log(`✅ ${fileName}: ${doc.status}`);
      } catch (err) {
        console.error(`❌ Error processing ${fileName}: ${err.message}`);
      }
    }
    active--;
  }

  const workers = [];
  for (let i = 0; i < limit; i++) {
    active++;
    workers.push(worker());
  }
  await Promise.all(workers);

  // Ensure metrics directory exists
  const metricsDir = path.dirname(RESULTS_PATH);
  if (!fs.existsSync(metricsDir)) fs.mkdirSync(metricsDir, { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf8');

  const avgTime = summary.processed ? Math.round(summary.totalMs / summary.processed) : 0;
  console.log('\n📊 Summary');
  console.log('Status counts:', summary.counts);
  console.log('Average totalMs:', avgTime, 'ms');
  console.log(`Results written to ${RESULTS_PATH}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
