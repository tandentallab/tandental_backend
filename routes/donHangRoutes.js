const express = require("express");
const router = express.Router();
const donHangController = require("../controllers/donHangController");


router.post("/", donHangController.createDonHang);
router.get("/", donHangController.getAllDonHang);
router.get("/:id", donHangController.getDonHangById);
router.put("/:id", donHangController.updateDonHang);
router.delete("/:id", donHangController.deleteDonHang);

module.exports = router;