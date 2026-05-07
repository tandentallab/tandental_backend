const express = require("express");
const router = express.Router();
const phieuThuController = require("../controllers/phieuThuController");

// Tạo phiếu thu
router.post("/", phieuThuController.createPhieuThu);

// Lấy theo hóa đơn
// router.get("/hoa-don/:hoaDonId", phieuThuController.getPhieuThuByHoaDon);

// // Xóa
// router.delete("/:id", phieuThuController.deletePhieuThu);

module.exports = router;