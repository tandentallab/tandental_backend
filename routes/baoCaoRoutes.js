const express = require('express');
const router = express.Router();
const baoCaoController = require('../controllers/baoCaoController'); // Đường dẫn tới file controller ở trên
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

router.get('/top-products', verifyToken, checkPermission, baoCaoController.getTopProductsReport);
router.get("/detailed-report", verifyToken, checkPermission, baoCaoController.getDetailedProductReport);
router.get('/san-luong-khach-hang', verifyToken, checkPermission, baoCaoController.getSanLuongTheoKhachHang);
router.get('/doanh-so-khach-hang', verifyToken, checkPermission, baoCaoController.getDoanhSoTheoKhachHang);
router.get('/doanh-so-san-pham', verifyToken, checkPermission, baoCaoController.getDoanhSoTheoSanPham);
router.get('/doanh-so-thoi-gian', verifyToken, checkPermission, baoCaoController.getDoanhSoTheoThoiGian);
router.get('/doanh-thu-thang', verifyToken, checkPermission, baoCaoController.getDoanhThuThang);


module.exports = router;