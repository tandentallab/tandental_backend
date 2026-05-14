const express = require("express");
const router = express.Router();
const controller = require("../controllers/nhaCungCapController");
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const allowAdminOnly = authorizeRoles(APP_ROLES.ADMIN);

router.get("/", verifyToken, allowAdminOnly, controller.getAllNhaCungCap);
router.get("/:id", verifyToken, allowAdminOnly, controller.getNhaCungCapById);
router.post("/", verifyToken, allowAdminOnly, controller.createNhaCungCap);
router.put("/:id", verifyToken, allowAdminOnly, controller.updateNhaCungCap);
router.delete("/:id", verifyToken, allowAdminOnly, controller.softDeleteNhaCungCap);

module.exports = router;
