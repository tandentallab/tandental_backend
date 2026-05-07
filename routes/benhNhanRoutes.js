const express = require("express");
const router = express.Router();

const {
  createBenhNhan,
  getAllBenhNhan,
  updateBenhNhan,
} = require("../controllers/benhNhanController");

const { verifyToken } = require("../middleware/authMiddleware");


router.post("/",verifyToken, createBenhNhan);
router.get("/",verifyToken, getAllBenhNhan);
router.put("/:id",verifyToken, updateBenhNhan)

module.exports = router;