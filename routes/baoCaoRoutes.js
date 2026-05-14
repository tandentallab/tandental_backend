const express = require('express');
const router = express.Router();
const baoCaoController = require('../controllers/baoCaoController'); // Đường dẫn tới file controller ở trên
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const allowAdminAndKeToan = authorizeRoles(APP_ROLES.ADMIN, APP_ROLES.KE_TOAN);

router.get('/top-products', verifyToken, allowAdminAndKeToan, baoCaoController.getTopProductsReport);
router.get("/detailed-report", verifyToken, allowAdminAndKeToan, baoCaoController.getDetailedProductReport);
router.get('/doanh-thu-thang', verifyToken, allowAdminAndKeToan, baoCaoController.getDoanhThuThang);


module.exports = router;