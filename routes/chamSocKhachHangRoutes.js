const express = require("express");
const router = express.Router();

const {
  createChamSoc,
  getChamSocByNhaKhoa,
  updateChamSoc,
  deleteChamSoc,
  getChamSocHomNay,
} = require("../controllers/chamSocKhachHangController");

const { verifyToken } = require("../middleware/authMiddleware");

// ➕ Tạo
router.post("/", verifyToken, createChamSoc);

// 📄 Lấy theo nha khoa
router.get("/nha-khoa/:nhaKhoaId", verifyToken, getChamSocByNhaKhoa);

// 🔔 Lịch hôm nay
router.get("/hom-nay", verifyToken, getChamSocHomNay);

// ✏️ Update
router.put("/:id", verifyToken, updateChamSoc);

// ❌ Delete
router.delete("/:id", verifyToken, deleteChamSoc);

module.exports = router;