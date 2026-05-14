const express = require("express");
const router = express.Router();

const {
  createNhaKhoa,
  getAllNhaKhoa,
  updateNhaKhoa,
} = require("../controllers/nhaKhoaController");

const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const allowAdminAndNhanVien = authorizeRoles(APP_ROLES.ADMIN, APP_ROLES.NHAN_VIEN);

router.post("/",verifyToken, allowAdminAndNhanVien, createNhaKhoa);
router.get("/",verifyToken, allowAdminAndNhanVien, getAllNhaKhoa);
router.put("/:id",verifyToken, allowAdminAndNhanVien, updateNhaKhoa)


module.exports = router;