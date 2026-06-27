const express = require("express");
const router = express.Router();
const phieuThuController = require("../controllers/phieuThuController");
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

// Lấy tất cả phiếu thu
router.get("/", verifyToken, checkPermission, phieuThuController.getAllPhieuThu);

router.get(
  "/hoa-don/:hoaDonId",
  phieuThuController.getPhieuThuByHoaDonId
);

// Lấy chi tiết phiếu thu
router.get("/:id", verifyToken, checkPermission, phieuThuController.getPhieuThuById);

// Tạo phiếu thu
router.post("/", verifyToken, checkPermission, phieuThuController.createPhieuThu);

// Cập nhật phiếu thu
router.patch("/:id", verifyToken, checkPermission, phieuThuController.updatePhieuThu);

module.exports = router;