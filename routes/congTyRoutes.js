const express = require("express");
const router = express.Router();

const { getCompany, updateCompany } = require("../controllers/congTyController");
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

// 🔓 Public - Lấy thông tin công ty
router.get("/", getCompany);

// 🔒 Private - Cập nhật thông tin công ty
router.put("/", verifyToken, authorizeRoles(APP_ROLES.ADMIN), updateCompany);

module.exports = router;
