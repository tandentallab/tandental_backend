const express = require("express");
const router = express.Router();

const {
  createNguoiLienHe,
  getAllNguoiLienHe,
  updateNguoiLienHe,
} = require("../controllers/nguoiLienHeController");

const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const allowAdminAndNhanVien = authorizeRoles(APP_ROLES.ADMIN, APP_ROLES.NHAN_VIEN);


router.post("/",verifyToken, allowAdminAndNhanVien, createNguoiLienHe);
router.get("/",verifyToken, allowAdminAndNhanVien, getAllNguoiLienHe);
router.put("/:id",verifyToken, allowAdminAndNhanVien, updateNguoiLienHe)


module.exports = router;