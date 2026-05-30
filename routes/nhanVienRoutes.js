const express = require("express");

const router = express.Router();
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

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


const allowAdminAndKeToan = authorizeRoles(APP_ROLES.ADMIN, APP_ROLES.KE_TOAN);
const allowAllBusinessRoles = authorizeRoles(
  APP_ROLES.ADMIN,
  APP_ROLES.KE_TOAN,
  APP_ROLES.NHAN_VIEN
);

router.post("/", verifyToken, allowAdminAndKeToan, createNhanVien);

router.get("/", verifyToken, allowAllBusinessRoles, getAllNhanVien);

router.get("/:id", verifyToken, allowAllBusinessRoles, getNhanVienById);

router.put("/:id", verifyToken, allowAdminAndKeToan, updateNhanVien);

router.delete("/:id", verifyToken, allowAdminAndKeToan, deleteNhanVien);

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