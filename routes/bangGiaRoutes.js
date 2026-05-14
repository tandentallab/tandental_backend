const express = require("express");
const router = express.Router();

const {
  getAllBangGia,
  upsertBangGia,
  getBangGiaByNhaKhoa,
  deleteBangGia,
} = require("../controllers/bangGiaController");

const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const allowAdminOnly = authorizeRoles(APP_ROLES.ADMIN);

/* ================= ROUTES ================= */

// lấy tất cả bảng giá từ tất cả nha khoa
router.get("/", verifyToken, allowAdminOnly, getAllBangGia);

// lấy bảng giá theo nha khoa
router.get("/nha-khoa/:nhaKhoaId", verifyToken, allowAdminOnly, getBangGiaByNhaKhoa);

// tạo / cập nhật giá
router.post("/", verifyToken, allowAdminOnly, upsertBangGia);

// xóa (reset về giá chung)
router.delete("/:id", verifyToken, allowAdminOnly, deleteBangGia);

module.exports = router;