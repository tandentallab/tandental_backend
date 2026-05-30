const express = require("express");
const router = express.Router();

const {
  createBenhNhan,
  getAllBenhNhan,
  updateBenhNhan,
} = require("../controllers/benhNhanController");

const { verifyToken, checkPermission } = require("../middleware/authMiddleware");


router.post("/",verifyToken, checkPermission, createBenhNhan);
router.get("/",verifyToken, checkPermission, getAllBenhNhan);
router.put("/:id",verifyToken, checkPermission, updateBenhNhan)

module.exports = router;