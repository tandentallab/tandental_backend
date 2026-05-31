const express = require("express");
const router = express.Router();
const mauTheBaoHanhController = require("../controllers/mauTheBaoHanhController");

const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

// Lấy danh sách mẫu thẻ
router.get("/", verifyToken, checkPermission, mauTheBaoHanhController.getMauTheList);

// Lấy chi tiết mẫu thẻ
router.get("/:id", verifyToken, checkPermission, mauTheBaoHanhController.getMauTheById);

// Tạo mẫu thẻ
router.post("/", verifyToken, checkPermission, mauTheBaoHanhController.createMauThe);

// Cập nhật mẫu thẻ
router.put("/:id", verifyToken, checkPermission, mauTheBaoHanhController.updateMauThe);

// Xóa mẫu thẻ
router.delete("/:id", verifyToken, checkPermission, mauTheBaoHanhController.deleteMauThe);

module.exports = router;