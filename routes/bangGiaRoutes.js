const express = require("express");
const router = express.Router();

const {
  getAllBangGia,
  upsertBangGia,
  getBangGiaByNhaKhoa,
  deleteBangGia,
  applyBangGiaTemplate
} = require("../controllers/bangGiaController");

const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

/* ================= ROUTES ================= */

// lấy tất cả bảng giá từ tất cả nha khoa
router.get("/", verifyToken, checkPermission, getAllBangGia);

// lấy bảng giá theo nha khoa
router.get("/nha-khoa/:nhaKhoaId", verifyToken, checkPermission, getBangGiaByNhaKhoa);

// tạo / cập nhật giá
router.post("/", verifyToken, checkPermission, upsertBangGia);

// xóa (reset về giá chung)
router.delete("/:id", verifyToken, checkPermission, deleteBangGia);

router.post(
  "/apply-template",
  verifyToken,
  checkPermission,
  applyBangGiaTemplate
);

module.exports = router;