const express = require("express");

const router = express.Router();

const {
  getActivityLogs,
} = require("../controllers/activityLogController");

const {
  verifyToken,
  checkPermission,
} = require("../middleware/authMiddleware");


// ================= GET ALL =================
router.get(
  "/",
  verifyToken,
  checkPermission,
  getActivityLogs
);

module.exports = router;