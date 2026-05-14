const express = require("express");
const router = express.Router();
const phieuBaoHanhController = require("../controllers/phieuBaoHanhController");
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const allowAllBusinessRoles = authorizeRoles(
	APP_ROLES.ADMIN,
	APP_ROLES.KE_TOAN,
	APP_ROLES.NHAN_VIEN
);

router.post("/", verifyToken, allowAllBusinessRoles, phieuBaoHanhController.createPhieuBaoHanh);
router.get("/", verifyToken, allowAllBusinessRoles, phieuBaoHanhController.getAllPhieuBaoHanh);
router.get("/don-hang/:donHangId", verifyToken, allowAllBusinessRoles, phieuBaoHanhController.getPhieuBaoHanhByDonHang);
router.get("/:id", verifyToken, allowAllBusinessRoles, phieuBaoHanhController.getPhieuBaoHanhById);
router.put("/:id", verifyToken, allowAllBusinessRoles, phieuBaoHanhController.updatePhieuBaoHanh);
router.delete("/:id", verifyToken, allowAllBusinessRoles, phieuBaoHanhController.deletePhieuBaoHanh);

module.exports = router;
