const express = require('express');
const router = express.Router();
const chiPhiController = require('../controllers/chiPhiController'); // Import đúng tên controller của bạn
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

// 1. Route tạo chi phí mới
router.post('/', verifyToken, checkPermission, chiPhiController.taoChiPhi);

// 2. Route lấy danh sách chi phí
router.get('/', verifyToken, checkPermission, chiPhiController.layDanhSachChiPhi);

// 3. Route xóa chi phí theo ID
router.delete('/:id', verifyToken, checkPermission, chiPhiController.xoaChiPhi);

module.exports = router;