// scripts/compute_eval.js
// Simple evaluation script that reads batch_results.json and a ground‑truth file
// (data/ground_truth.json) and writes summary metrics to backend/metrics/eval_results.json.
// The metrics are basic and intended for quick sanity checks during the hackathon.

const fs = require('fs');
const path = require('path');

// Paths – relative to project root
const BATCH_RESULTS = path.resolve(__dirname, '..', 'backend', 'metrics', 'batch_results.json');
const GROUND_TRUTH = path.resolve(__dirname, '..', 'data', 'ground_truth.json');
const OUT_PATH = path.resolve(__dirname, '..', 'backend', 'metrics', 'eval_results.json');

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function compareFields(result, truth) {
  // Compare a shallow set of numeric fields that matter for the demo.
  // Return number of matches and total fields compared.
  const fields = ['total', 'subtotal', 'tax'];
  let matches = 0;
  fields.forEach(f => {
    if (typeof result.extracted?.[f] === 'number' && typeof truth?.extracted?.[f] === 'number') {
      if (Math.abs(result.extracted[f] - truth.extracted[f]) < 0.01) matches++;
    }
  });
  return { matches, total: fields.length };
}

function evaluate() {
  const results = loadJson(BATCH_RESULTS);
  const truthArray = loadJson(GROUND_TRUTH);
  // Assume ground_truth is an array indexed by fileName
  const truthMap = {};
  truthArray.forEach(t => { truthMap[t.fileName] = t; });

  let fieldMatches = 0;
  let fieldTotal = 0;
  let truePos = 0; // correctly flagged issues
  let falseNeg = 0; // missed issues
  let falsePos = 0; // flagged but not present
  let totalMsSum = 0;
  let timedCount = 0;

  results.forEach(res => {
    const gt = truthMap[res.fileName];
    if (!gt) return; // skip if no ground truth

    // Field accuracy
    const { matches, total } = compareFields(res, gt);
    fieldMatches += matches;
    fieldTotal += total;

    // Issue detection (very naive) – compare issue types arrays
    const resIssues = (res.issues || []).map(i => i.type).sort();
    const gtIssues = (gt.issues || []).map(i => i.type).sort();
    const intersect = resIssues.filter(v => gtIssues.includes(v));
    truePos += intersect.length;
    falseNeg += gtIssues.filter(v => !resIssues.includes(v)).length;
    falsePos += resIssues.filter(v => !gtIssues.includes(v)).length;

    // Timing
    if (res.timing && typeof res.timing.totalMs === 'number') {
      totalMsSum += res.timing.totalMs;
      timedCount++;
    }
  });

  const fieldAccuracy = fieldTotal ? fieldMatches / fieldTotal : null;
  const errorCatchRate = (truePos + falseNeg) ? truePos / (truePos + falseNeg) : null;
  const falseAlarmRate = (truePos + falsePos) ? falsePos / (truePos + falsePos) : null;
  const avgTotalMs = timedCount ? Math.round(totalMsSum / timedCount) : null;

  const evalObj = {
    fieldAccuracy,
    errorCatchRate,
    falseAlarmRate,
    avgTotalMs,
    generatedAt: new Date().toISOString()
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(evalObj, null, 2), 'utf8');
  console.log('Evaluation results written to', OUT_PATH);
  console.log(evalObj);
}

evaluate();
