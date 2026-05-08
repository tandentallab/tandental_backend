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

const { verifyToken } = require("../middleware/authMiddleware");

// 🔓 public
router.post("/register", createStaff);
router.post("/login", loginStaff);

// 🔒 private
router.get("/me", verifyToken, getCurrentStaff); // ← Phải để TRƯỚC /:id
router.get("/", verifyToken, getAllStaff);
router.get("/:id", verifyToken, getStaffById);
router.put("/:id", verifyToken, updateStaff);
router.delete("/:id", verifyToken, deleteStaff);

module.exports = router;