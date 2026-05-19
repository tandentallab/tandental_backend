const express = require("express");
const router = express.Router();
const mauTheBaoHanhController = require("../controllers/mauTheBaoHanhController");

// 👉 1. Import đúng các hàm có sẵn trong authMiddleware
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

// 👉 2. Tự định nghĩa allowAllBusinessRoles tại đây (giống hệt phieuBaoHanhRoutes)
const allowAllBusinessRoles = authorizeRoles(
	APP_ROLES.ADMIN,
	APP_ROLES.KE_TOAN,
	APP_ROLES.NHAN_VIEN
);

// Lấy danh sách mẫu thẻ
router.get("/", verifyToken, allowAllBusinessRoles, mauTheBaoHanhController.getMauTheList);

// Lấy chi tiết mẫu thẻ
router.get("/:id", verifyToken, allowAllBusinessRoles, mauTheBaoHanhController.getMauTheById);

// Tạo mẫu thẻ
router.post("/", verifyToken, allowAllBusinessRoles, mauTheBaoHanhController.createMauThe);

// Cập nhật mẫu thẻ
router.put("/:id", verifyToken, allowAllBusinessRoles, mauTheBaoHanhController.updateMauThe);

// Xóa mẫu thẻ
router.delete("/:id", verifyToken, allowAllBusinessRoles, mauTheBaoHanhController.deleteMauThe);

module.exports = router;