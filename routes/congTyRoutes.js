const express = require("express");
const router = express.Router();
const { getCompany, updateCompany, uploadLogo } = require("../controllers/congTyController");
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");
const uploadCCCD = require("../middleware/uploadCCCD");

// 🔓 Public - Lấy thông tin công ty
router.get("/", getCompany);

// 🔒 Private - Cập nhật thông tin công ty
router.put("/", verifyToken, checkPermission, updateCompany);

// 🔒 Private - Upload logo công ty
router.post("/upload-logo", verifyToken, checkPermission, uploadCCCD.single("file"), uploadLogo);

module.exports = router;
