const express = require("express");
const router = express.Router();
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const {
  getAllQuyenSuDungIncludeInactive,
  createQuyenSuDung,
  getAllQuyenSuDung,
  getQuyenSuDungById,
  updateQuyenSuDung,
  deleteQuyenSuDung,
  restoreQuyenSuDung,
} = require("../controllers/quyenSuDungController");

// 🔒 Admin - Quản lý quyền sử dụng
router.get("/", verifyToken, authorizeRoles(APP_ROLES.ADMIN), getAllQuyenSuDung);
router.get("/all", verifyToken, authorizeRoles(APP_ROLES.ADMIN), getAllQuyenSuDungIncludeInactive); // Lấy tất cả (bao gồm inactive)
router.get("/:id", verifyToken, authorizeRoles(APP_ROLES.ADMIN), getQuyenSuDungById);

// 🔒 Private - CRUD
router.post("/", verifyToken, authorizeRoles(APP_ROLES.ADMIN), createQuyenSuDung);
router.put("/:id", verifyToken, authorizeRoles(APP_ROLES.ADMIN), updateQuyenSuDung);
router.delete("/:id", verifyToken, authorizeRoles(APP_ROLES.ADMIN), deleteQuyenSuDung);
router.put("/:id/restore", verifyToken, authorizeRoles(APP_ROLES.ADMIN), restoreQuyenSuDung); // Restore

module.exports = router;
