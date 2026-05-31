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

const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

// 🔓 public
router.post("/register", verifyToken, checkPermission, createStaff);
router.post("/login", loginStaff);

// 🔒 private
router.get("/me", verifyToken, getCurrentStaff); // ← Phải để TRƯỚC /:id
router.get("/", verifyToken, checkPermission, getAllStaff);
router.get("/:id", verifyToken, checkPermission, getStaffById);
router.put("/:id", verifyToken, checkPermission, updateStaff);
router.delete("/:id", verifyToken, checkPermission, deleteStaff);

module.exports = router;