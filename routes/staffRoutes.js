const express = require("express");
const router = express.Router();

const {
  createStaff,
  loginStaff,
  getCurrentStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
} = require("../controllers/staffController");

const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

// 🔓 public
router.post("/register", verifyToken, authorizeRoles(APP_ROLES.ADMIN), createStaff);
router.post("/login", loginStaff);

// 🔒 private
router.get("/me", verifyToken, getCurrentStaff); // ← Phải để TRƯỚC /:id
router.get("/", verifyToken, authorizeRoles(APP_ROLES.ADMIN), getAllStaff);
router.get("/:id", verifyToken, authorizeRoles(APP_ROLES.ADMIN), getStaffById);
router.put("/:id", verifyToken, authorizeRoles(APP_ROLES.ADMIN), updateStaff);
router.delete("/:id", verifyToken, authorizeRoles(APP_ROLES.ADMIN), deleteStaff);

module.exports = router;