const express = require("express");
const router = express.Router();

const {
    createSanPham,
    getAllSanPham,
    updateSanPham,
    deleteSanPham,
} = require("../controllers/sanPhamController");

const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

// Thêm và Lấy danh sách
router.post("/", verifyToken, checkPermission, createSanPham);
router.get("/", verifyToken, checkPermission, getAllSanPham);

// Sửa và Xóa cần truyền thêm ID trên URL (ví dụ: /api/sanpham/64a1b2c3...)
router.put("/:id", verifyToken, checkPermission, updateSanPham);
router.delete("/:id", verifyToken, checkPermission, deleteSanPham);

module.exports = router;