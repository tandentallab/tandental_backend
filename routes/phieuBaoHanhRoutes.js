const express = require("express");
const router = express.Router();
const phieuBaoHanhController = require("../controllers/phieuBaoHanhController");

router.post("/", phieuBaoHanhController.createPhieuBaoHanh);
router.get("/", phieuBaoHanhController.getAllPhieuBaoHanh);
router.get("/don-hang/:donHangId", phieuBaoHanhController.getPhieuBaoHanhByDonHang);
router.get("/:id", phieuBaoHanhController.getPhieuBaoHanhById);
router.put("/:id", phieuBaoHanhController.updatePhieuBaoHanh);
router.delete("/:id", phieuBaoHanhController.deletePhieuBaoHanh);

module.exports = router;
