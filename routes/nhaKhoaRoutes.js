const express = require("express");
const router = express.Router();

const {
  createNhaKhoa,
  getAllNhaKhoa,
  updateNhaKhoa,
} = require("../controllers/nhaKhoaController");

const { verifyToken } = require("../middleware/authMiddleware");


router.post("/",verifyToken, createNhaKhoa);
router.get("/",verifyToken, getAllNhaKhoa);
router.put("/:id",verifyToken, updateNhaKhoa)


module.exports = router;