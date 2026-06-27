const express = require("express");
const router = express.Router();
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

const {
  createGhiChu,
  getAllGhiChu,
  deleteGhiChu,
} = require("../controllers/ghiChuController");

router.post("/", verifyToken, checkPermission, createGhiChu);
router.get("/", verifyToken, checkPermission, getAllGhiChu);
router.delete("/:id", verifyToken, checkPermission, deleteGhiChu);

module.exports = router;
