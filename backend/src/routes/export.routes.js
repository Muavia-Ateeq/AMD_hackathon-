// backend/src/routes/export.routes.js
// Endpoint to retrieve batch evaluation results.

const express = require('express');
const router = express.Router();
const { getExportResults } = require('../controllers/exportController');

router.get('/results', getExportResults);

module.exports = router;
