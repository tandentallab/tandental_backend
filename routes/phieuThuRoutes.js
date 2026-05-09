const express = require("express");
const router = express.Router();
const phieuThuController = require("../controllers/phieuThuController");
const { verifyToken } = require("../middleware/authMiddleware");

// Lấy tất cả phiếu thu
router.get("/", phieuThuController.getAllPhieuThu);

// Tạo phiếu thu
router.post("/", verifyToken, phieuThuController.createPhieuThu);

// Cập nhật phiếu thu
router.patch("/:id", phieuThuController.updatePhieuThu);

module.exports = router;