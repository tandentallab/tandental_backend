const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");

const {
  getAllQuyenSuDungIncludeInactive,
  createQuyenSuDung,
  getAllQuyenSuDung,
  getQuyenSuDungById,
  updateQuyenSuDung,
  deleteQuyenSuDung,
  restoreQuyenSuDung,
} = require("../controllers/quyenSuDungController");

// 🔓 Public - Lấy danh sách (chỉ active - để select dropdown)
router.get("/", getAllQuyenSuDung);
router.get("/all", getAllQuyenSuDungIncludeInactive); // Lấy tất cả (bao gồm inactive)
router.get("/:id", getQuyenSuDungById);

// 🔒 Private - CRUD
router.post("/", verifyToken, createQuyenSuDung);
router.put("/:id", verifyToken, updateQuyenSuDung);
router.delete("/:id", verifyToken, deleteQuyenSuDung);
router.put("/:id/restore", verifyToken, restoreQuyenSuDung); // Restore

module.exports = router;
