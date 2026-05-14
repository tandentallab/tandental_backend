const express = require("express");

const router = express.Router();
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const {
  createBangLuong,
  getAllBangLuong,
  getBangLuongById,
  deleteBangLuong,
  deleteBangLuongByMonthYear
} = require("../controllers/bangLuongController");

const allowAdminAndKeToan = authorizeRoles(APP_ROLES.ADMIN, APP_ROLES.KE_TOAN);

router.post("/", verifyToken, allowAdminAndKeToan, createBangLuong);

router.get("/", verifyToken, allowAdminAndKeToan, getAllBangLuong);

router.get("/:id", verifyToken, allowAdminAndKeToan, getBangLuongById);

router.delete(
  "/",
  verifyToken,
  allowAdminAndKeToan,
  deleteBangLuongByMonthYear
);

router.delete("/:id", verifyToken, allowAdminAndKeToan, deleteBangLuong);

module.exports = router;