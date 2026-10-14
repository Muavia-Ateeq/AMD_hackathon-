// backend/src/routes/orders.routes.js
// Routes for purchase orders. Owned by Ammar

const express = require('express');
const { listOrders } = require('../controllers/ordersController');

const router = express.Router();

router.get('/', listOrders);

module.exports = router;
