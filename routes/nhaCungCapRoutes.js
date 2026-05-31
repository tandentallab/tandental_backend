const express = require("express");
const router = express.Router();
const controller = require("../controllers/nhaCungCapController");
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

router.get("/", verifyToken, checkPermission, controller.getAllNhaCungCap);
router.get("/:id", verifyToken, checkPermission, controller.getNhaCungCapById);
router.post("/", verifyToken, checkPermission, controller.createNhaCungCap);
router.put("/:id", verifyToken, checkPermission, controller.updateNhaCungCap);
router.delete("/:id", verifyToken, checkPermission, controller.softDeleteNhaCungCap);

module.exports = router;
