const express = require("express");
const router = express.Router();
const phieuThuController = require("../controllers/phieuThuController");
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const allowAdminAndKeToan = authorizeRoles(APP_ROLES.ADMIN, APP_ROLES.KE_TOAN);

// Lấy tất cả phiếu thu
router.get("/", verifyToken, allowAdminAndKeToan, phieuThuController.getAllPhieuThu);

// Lấy chi tiết phiếu thu
router.get("/:id", verifyToken, allowAdminAndKeToan, phieuThuController.getPhieuThuById);

// Tạo phiếu thu
router.post("/", verifyToken, allowAdminAndKeToan, phieuThuController.createPhieuThu);

// Cập nhật phiếu thu
router.patch("/:id", verifyToken, allowAdminAndKeToan, phieuThuController.updatePhieuThu);

module.exports = router;