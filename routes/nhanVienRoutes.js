const express = require("express");

const router = express.Router();
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

const {
  createNhanVien,
  getAllNhanVien,
  getNhanVienById,
  updateNhanVien,
  deleteNhanVien,
  uploadCCCD,
  deleteCCCDImage
} = require("../controllers/nhanVienController");

const uploadCCCDMiddleware = require("../middleware/uploadCCCD");

router.post("/", verifyToken, checkPermission, createNhanVien);

router.get("/", verifyToken, checkPermission, getAllNhanVien);

router.get("/:id", verifyToken, checkPermission, getNhanVienById);

router.put("/:id", verifyToken, checkPermission, updateNhanVien);

router.delete("/:id", verifyToken, checkPermission, deleteNhanVien);

// upload nhiều ảnh
router.post(
  "/:id/upload-cccd",
  uploadCCCDMiddleware.array("images", 10),
  uploadCCCD
);

router.delete(
  "/:id/delete-cccd",
  deleteCCCDImage
);

module.exports = router;

module.exports = router;