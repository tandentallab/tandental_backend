const express = require('express');
const router = express.Router();
const chiPhiController = require('../controllers/chiPhiController'); // Import đúng tên controller của bạn
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

// 1. Route tạo chi phí mới
router.post('/', verifyToken, checkPermission, chiPhiController.taoChiPhi);

// 2. Route lấy danh sách chi phí
router.get('/', verifyToken, checkPermission, chiPhiController.layDanhSachChiPhi);
router.get('/loai', verifyToken, checkPermission, chiPhiController.layDanhSachLoaiChiPhi);

// 3. Route xóa chi phí theo ID
router.delete('/:id', verifyToken, checkPermission, chiPhiController.xoaChiPhi);

// 4. Route cập nhật chi phí theo ID (Mới thêm)
router.put('/:id', verifyToken, checkPermission, chiPhiController.updateChiPhi);

router.get('/thong-ke-vat-lieu', verifyToken, checkPermission, chiPhiController.thongKeChiPhiNhapTheoThang);

module.exports = router;