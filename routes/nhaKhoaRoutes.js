const express = require("express");
const router = express.Router();

const {
  getAllNhaKhoa,
  updateNhaKhoa,
  deleteNhaKhoa,
  updateSoDuDauKy,
  upsertGhiChu,
  timNhaKhoaBenCrm,
  taoNhaKhoaTuCrm
} = require("../controllers/nhaKhoaController");

const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

router.get("/", verifyToken, checkPermission, getAllNhaKhoa);
router.get("/crm", verifyToken, checkPermission, timNhaKhoaBenCrm);
router.post("/tu-crm", verifyToken, checkPermission, taoNhaKhoaTuCrm);
router.put('/:id/so-du-dau-ky', updateSoDuDauKy);
router.put("/:id/ghi-chu", verifyToken, checkPermission, upsertGhiChu);
router.put("/:id", verifyToken, checkPermission, updateNhaKhoa)
router.delete("/:id", verifyToken, checkPermission, deleteNhaKhoa);

module.exports = router;