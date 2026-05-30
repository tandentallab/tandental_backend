const express = require("express");

const router = express.Router();
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

const {
  createBangLuong,
  getAllBangLuong,
  getBangLuongById,
  deleteBangLuong,
  deleteBangLuongByMonthYear
} = require("../controllers/bangLuongController");

router.post("/", verifyToken, checkPermission, createBangLuong);

router.get("/", verifyToken, checkPermission, getAllBangLuong);

router.get("/:id", verifyToken, checkPermission, getBangLuongById);

router.delete(
  "/",
  verifyToken,
  checkPermission,
  deleteBangLuongByMonthYear
);

router.delete("/:id", verifyToken, checkPermission, deleteBangLuong);

module.exports = router;