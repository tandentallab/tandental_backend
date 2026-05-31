const express = require("express");
const router = express.Router();
const phieuBaoHanhController = require("../controllers/phieuBaoHanhController");
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

router.post("/", verifyToken, checkPermission, phieuBaoHanhController.createPhieuBaoHanh);
router.get("/", verifyToken, checkPermission, phieuBaoHanhController.getAllPhieuBaoHanh);
router.get("/don-hang/:donHangId", verifyToken, checkPermission, phieuBaoHanhController.getPhieuBaoHanhByDonHang);
router.get("/:id", verifyToken, checkPermission, phieuBaoHanhController.getPhieuBaoHanhById);
router.put("/:id", verifyToken, checkPermission, phieuBaoHanhController.updatePhieuBaoHanh);
router.delete("/:id", verifyToken, checkPermission, phieuBaoHanhController.deletePhieuBaoHanh);

module.exports = router;
