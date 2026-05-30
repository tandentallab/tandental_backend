const express = require("express");
const router = express.Router();
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

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
router.get("/", verifyToken, checkPermission, getAllQuyenSuDung);
router.get("/all", verifyToken, checkPermission, getAllQuyenSuDungIncludeInactive); // Lấy tất cả (bao gồm inactive)
router.get("/:id", verifyToken, checkPermission, getQuyenSuDungById);

// 🔒 Private - CRUD
router.post("/", verifyToken, checkPermission, createQuyenSuDung);
router.put("/:id", verifyToken, checkPermission, updateQuyenSuDung);
router.delete("/:id", verifyToken, checkPermission, deleteQuyenSuDung);
router.put("/:id/restore", verifyToken, checkPermission, restoreQuyenSuDung); // Restore

module.exports = router;
