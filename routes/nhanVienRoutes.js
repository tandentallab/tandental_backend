const express = require("express");

const router = express.Router();
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const {
  createNhanVien,
  getAllNhanVien,
  getNhanVienById,
  updateNhanVien,
  deleteNhanVien,
} = require("../controllers/nhanVienController");

const allowAdminAndKeToan = authorizeRoles(APP_ROLES.ADMIN, APP_ROLES.KE_TOAN);

router.post("/", verifyToken, allowAdminAndKeToan, createNhanVien);

router.get("/", verifyToken, allowAdminAndKeToan, getAllNhanVien);

router.get("/:id", verifyToken, allowAdminAndKeToan, getNhanVienById);

router.put("/:id", verifyToken, allowAdminAndKeToan, updateNhanVien);

router.delete("/:id", verifyToken, allowAdminAndKeToan, deleteNhanVien);

module.exports = router;