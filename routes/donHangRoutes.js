const express = require("express");
const router = express.Router();
const donHangController = require("../controllers/donHangController");
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");


const allowAllBusinessRoles = authorizeRoles(
	APP_ROLES.ADMIN,
	APP_ROLES.KE_TOAN,
	APP_ROLES.NHAN_VIEN
);

router.post("/", verifyToken, allowAllBusinessRoles, donHangController.createDonHang);
router.get("/", verifyToken, allowAllBusinessRoles, donHangController.getAllDonHang);
router.get("/:id", verifyToken, allowAllBusinessRoles, donHangController.getDonHangById);
router.put("/:id", verifyToken, allowAllBusinessRoles, donHangController.updateDonHang);
router.patch("/:id/congdoan-status", verifyToken, allowAllBusinessRoles, donHangController.updateCongDoanStatus);
router.delete("/:id", verifyToken, authorizeRoles(APP_ROLES.ADMIN), donHangController.deleteDonHang);

module.exports = router;