const express = require("express");
const router = express.Router();

const {
  createNhaKhoa,
  getAllNhaKhoa,
  updateNhaKhoa,
  updateSoDuDauKy,
  upsertGhiChu
} = require("../controllers/nhaKhoaController");

const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

router.post("/", verifyToken, checkPermission, createNhaKhoa);
router.get("/", verifyToken, checkPermission, getAllNhaKhoa);
router.put('/:id/so-du-dau-ky', updateSoDuDauKy);
router.put("/:id", verifyToken, checkPermission, updateNhaKhoa)

module.exports = router;