// backend/src/controllers/exportController.js
// Returns the batch results JSON for evaluation purposes.
// Produced by scripts/run_batch.js (repo root), which writes
// backend/metrics/batch_results.json.

const fs = require('fs');
const path = require('path');

// __dirname is backend/src/controllers, so ../../ is backend/.
// The previous path joined another 'backend' segment, resolving to
// backend/backend/metrics/ and guaranteeing a permanent 404.
const RESULTS_PATH = path.resolve(__dirname, '..', '..', 'metrics', 'batch_results.json');
const EVAL_PATH = path.resolve(__dirname, '..', '..', 'metrics', 'eval_results.json');

async function getExportResults(req, res, next) {
  try {
    if (!fs.existsSync(RESULTS_PATH)) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Batch results not found. Run `npm run batch` to generate them.'
        }
      });
    }
    const data = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));

    // Attach the computed evaluation summary when it exists, so a consumer gets
    // metrics and per-document results from a single call.
    if (fs.existsSync(EVAL_PATH)) {
      data.eval = JSON.parse(fs.readFileSync(EVAL_PATH, 'utf8'));
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getExportResults, RESULTS_PATH, EVAL_PATH };