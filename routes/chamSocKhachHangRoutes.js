const express = require("express");
const router = express.Router();

const {
  createChamSoc,
  getChamSocByNhaKhoa,
  updateChamSoc,
  deleteChamSoc,
  getChamSocHomNay,
} = require("../controllers/chamSocKhachHangController");

const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const allowAdminOnly = authorizeRoles(APP_ROLES.ADMIN);

// ➕ Tạo
router.post("/", verifyToken, allowAdminOnly, createChamSoc);

// 📄 Lấy theo nha khoa
router.get("/nha-khoa/:nhaKhoaId", verifyToken, allowAdminOnly, getChamSocByNhaKhoa);

// 🔔 Lịch hôm nay
router.get("/hom-nay", verifyToken, allowAdminOnly, getChamSocHomNay);

// ✏️ Update
router.put("/:id", verifyToken, allowAdminOnly, updateChamSoc);

// ❌ Delete
router.delete("/:id", verifyToken, allowAdminOnly, deleteChamSoc);

module.exports = router;