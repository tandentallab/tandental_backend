const express = require("express");
const router = express.Router();

const {
    createSanPham,
    getAllSanPham,
    updateSanPham,
    deleteSanPham,
} = require("../controllers/sanPhamController");

const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const allowAdminAndNhanVien = authorizeRoles(APP_ROLES.ADMIN, APP_ROLES.NHAN_VIEN);

// Thêm và Lấy danh sách
router.post("/", verifyToken, allowAdminAndNhanVien, createSanPham);
router.get("/", verifyToken, allowAdminAndNhanVien, getAllSanPham);

// Sửa và Xóa cần truyền thêm ID trên URL (ví dụ: /api/sanpham/64a1b2c3...)
router.put("/:id", verifyToken, allowAdminAndNhanVien, updateSanPham);
router.delete("/:id", verifyToken, allowAdminAndNhanVien, deleteSanPham);

module.exports = router;