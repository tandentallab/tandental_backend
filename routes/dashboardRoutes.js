const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

router.get(
	'/stats',
	verifyToken,
	authorizeRoles(APP_ROLES.ADMIN, APP_ROLES.KE_TOAN, APP_ROLES.NHAN_VIEN),
	dashboardController.getChartStats
);

module.exports = router;