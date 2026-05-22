const express = require("express");

const router = express.Router();

const {
  getActivityLogs,
} = require("../controllers/activityLogController");

const {
  verifyToken,
  authorizeRoles,
  APP_ROLES,
} = require("../middleware/authMiddleware");


// ================= GET ALL =================
router.get(
  "/",
  verifyToken,
  authorizeRoles(APP_ROLES.ADMIN),
  getActivityLogs
);

module.exports = router;