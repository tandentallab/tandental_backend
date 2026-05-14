const express = require("express");
const router = express.Router();

const {
  createBenhNhan,
  getAllBenhNhan,
  updateBenhNhan,
} = require("../controllers/benhNhanController");

const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const allowAdminAndNhanVien = authorizeRoles(APP_ROLES.ADMIN, APP_ROLES.NHAN_VIEN);


router.post("/",verifyToken, allowAdminAndNhanVien, createBenhNhan);
router.get("/",verifyToken, allowAdminAndNhanVien, getAllBenhNhan);
router.put("/:id",verifyToken, allowAdminAndNhanVien, updateBenhNhan)

module.exports = router;