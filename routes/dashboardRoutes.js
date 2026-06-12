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

// SSE endpoint — không dùng checkPermission vì SSE giữ kết nối lâu dài
router.get(
	'/realtime-stats',
	dashboardController.getRealtimeStats
);

router.get(
	"/don-hang-thang",
	dashboardController.getDonHangByMonth
);

module.exports = router;