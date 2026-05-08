const express = require("express");
const router = express.Router();

const { getCompany, updateCompany } = require("../controllers/congTyController");
const { verifyToken } = require("../middleware/authMiddleware");

// 🔓 Public - Lấy thông tin công ty
router.get("/", getCompany);

// 🔒 Private - Cập nhật thông tin công ty
router.put("/", verifyToken, updateCompany);

module.exports = router;
