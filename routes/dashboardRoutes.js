const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

router.get(
	'/stats',
	verifyToken,
	checkPermission,
	dashboardController.getChartStats
);

router.get(
	'/realtime-stats',
	dashboardController.getRealtimeStats
);

module.exports = router;