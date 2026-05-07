const express = require("express");
const router = express.Router();
const controller = require("../controllers/nhaCungCapController");

router.get("/", controller.getAllNhaCungCap);
router.get("/:id", controller.getNhaCungCapById);
router.post("/", controller.createNhaCungCap);
router.put("/:id", controller.updateNhaCungCap);
router.delete("/:id", controller.softDeleteNhaCungCap);

module.exports = router;
