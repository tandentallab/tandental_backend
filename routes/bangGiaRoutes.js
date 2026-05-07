const express = require("express");
const router = express.Router();

const {
  upsertBangGia,
  getBangGiaByNhaKhoa,
  deleteBangGia,
} = require("../controllers/bangGiaController");

const { verifyToken } = require("../middleware/authMiddleware");

/* ================= ROUTES ================= */

// lấy bảng giá theo nha khoa
router.get("/nha-khoa/:nhaKhoaId", verifyToken, getBangGiaByNhaKhoa);

// tạo / cập nhật giá
router.post("/", verifyToken, upsertBangGia);

// xóa (reset về giá chung)
router.delete("/:id", verifyToken, deleteBangGia);

module.exports = router;