const express = require("express");

const router = express.Router();
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

const {
  createBangLuong,
  getAllBangLuong,
  getBangLuongById,
  deleteBangLuong,
  deleteBangLuongByMonthYear,
  getLichSuLuong,
} = require("../controllers/bangLuongController");

router.post("/", verifyToken, checkPermission, createBangLuong);

router.get("/", verifyToken, checkPermission, getAllBangLuong);

// ⚠️ Route cụ thể "/lich-su/tong-hop" PHẢI khai báo TRƯỚC route "/:id"
// nếu không Express sẽ hiểu "lich-su" là 1 giá trị :id và gọi nhầm getBangLuongById
router.get(
  "/lich-su/tong-hop",
  verifyToken,
  checkPermission,
  getLichSuLuong
);

router.get("/:id", verifyToken, checkPermission, getBangLuongById);

router.delete(
  "/",
  verifyToken,
  checkPermission,
  deleteBangLuongByMonthYear
);

router.delete("/:id", verifyToken, checkPermission, deleteBangLuong);

module.exports = router;