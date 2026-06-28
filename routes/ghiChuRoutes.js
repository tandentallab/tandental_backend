const express = require("express");
const router = express.Router();
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

const {
  createGhiChu,
  getAllGhiChu,
  deleteGhiChu,
  updateGhiChuTrangThai,
  deleteCompletedGhiChu,
  updateGhiChu,
} = require("../controllers/ghiChuController");

router.post("/", verifyToken, checkPermission, createGhiChu);
router.get("/", verifyToken, checkPermission, getAllGhiChu);
router.delete("/completed/clean", verifyToken, checkPermission, deleteCompletedGhiChu);
router.delete("/:id", verifyToken, checkPermission, deleteGhiChu);
router.patch("/:id/trang-thai", verifyToken, checkPermission, updateGhiChuTrangThai);
router.put("/:id", verifyToken, checkPermission, updateGhiChu);

module.exports = router;
