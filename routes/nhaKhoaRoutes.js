const express = require("express");
const router = express.Router();

const {
  createNhaKhoa,
  getAllNhaKhoa,
  updateNhaKhoa,
  deleteNhaKhoa,
  updateSoDuDauKy,
  upsertGhiChu,
  getNhaKhoaLauChuaGuiDon
} = require("../controllers/nhaKhoaController");

const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

router.post("/", verifyToken, checkPermission, createNhaKhoa);
router.get("/", verifyToken, checkPermission, getAllNhaKhoa);
router.get("/lau-chua-gui-don", verifyToken, checkPermission, getNhaKhoaLauChuaGuiDon);
router.put('/:id/so-du-dau-ky', updateSoDuDauKy);
router.put("/:id/ghi-chu", verifyToken, checkPermission, upsertGhiChu);
router.put("/:id", verifyToken, checkPermission, updateNhaKhoa)
router.delete("/:id", verifyToken, checkPermission, deleteNhaKhoa);

module.exports = router;