const express = require("express");
const router = express.Router();

const {
  createNhaCungCap,
  getAllNhaCungCap,
  updateNhaCungCap,
  deleteNhaCungCap,
} = require("../controllers/nhaCungCapController");

const {
  createVatLieu,
  getAllVatLieu,
  getThongKeVatLieu,
  getTuyChonVatLieu,
  updateVatLieu,
  deleteVatLieu,
  deleteVatLieuMany,
  seedVatLieuTest,
  deleteVatLieuTest,
} = require("../controllers/vatLieuController");

const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

// ===== NHÀ CUNG CẤP =====
router.get("/nha-cung-cap", verifyToken, checkPermission, getAllNhaCungCap);
router.post("/nha-cung-cap", verifyToken, checkPermission, createNhaCungCap);
router.put("/nha-cung-cap/:id", verifyToken, checkPermission, updateNhaCungCap);
router.delete("/nha-cung-cap/:id", verifyToken, checkPermission, deleteNhaCungCap);

// ===== VẬT LIỆU =====
router.get("/vat-lieu/thong-ke", verifyToken, checkPermission, getThongKeVatLieu); // đặt trước /vat-lieu/:id để tránh xung đột route
router.get("/vat-lieu/tuy-chon", verifyToken, checkPermission, getTuyChonVatLieu); // đặt trước /vat-lieu/:id để tránh xung đột route


router.get("/vat-lieu", verifyToken, checkPermission, getAllVatLieu);
router.post("/vat-lieu", verifyToken, checkPermission, createVatLieu);
router.delete("/vat-lieu", verifyToken, checkPermission, deleteVatLieuMany); // xóa nhiều
router.put("/vat-lieu/:id", verifyToken, checkPermission, updateVatLieu);
router.delete("/vat-lieu/:id", verifyToken, checkPermission, deleteVatLieu);

module.exports = router;

// ===== ĐĂNG KÝ VÀO app.js =====
// const khoRoutes = require("./routes/khoRoutes");
// app.use("/api/kho", khoRoutes);
