const express = require("express");
const router = express.Router();
const donHangController = require("../controllers/donHangController");
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

router.post("/", verifyToken, checkPermission, donHangController.createDonHang);
router.get("/", verifyToken, checkPermission, donHangController.getAllDonHang);
router.get("/thong-ke", verifyToken, checkPermission, donHangController.getThongKe);
router.get("/:id", verifyToken, checkPermission, donHangController.getDonHangById);
router.put("/:id", verifyToken, checkPermission, donHangController.updateDonHang);
router.patch("/:id/congdoan-status", verifyToken, checkPermission, donHangController.updateCongDoanStatus);
router.delete("/:id", verifyToken, checkPermission, donHangController.deleteDonHang);
module.exports = router;