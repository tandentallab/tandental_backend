const express = require("express");
const router = express.Router();

const {
  createChamSoc,
  getChamSocByNhaKhoa,
  updateChamSoc,
  deleteChamSoc,
  getChamSocHomNay,
} = require("../controllers/chamSocKhachHangController");

const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

// ➕ Tạo
router.post("/", verifyToken, checkPermission, createChamSoc);

// 📄 Lấy theo nha khoa
router.get("/nha-khoa/:nhaKhoaId", verifyToken, checkPermission, getChamSocByNhaKhoa);

// 🔔 Lịch hôm nay
router.get("/hom-nay", verifyToken, checkPermission, getChamSocHomNay);

// ✏️ Update
router.put("/:id", verifyToken, checkPermission, updateChamSoc);

// ❌ Delete
router.delete("/:id", verifyToken, checkPermission, deleteChamSoc);

module.exports = router;