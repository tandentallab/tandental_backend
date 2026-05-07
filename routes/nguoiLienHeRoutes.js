const express = require("express");
const router = express.Router();

const {
  createNguoiLienHe,
  getAllNguoiLienHe,
  updateNguoiLienHe,
} = require("../controllers/nguoiLienHeController");

const { verifyToken } = require("../middleware/authMiddleware");


router.post("/",verifyToken, createNguoiLienHe);
router.get("/",verifyToken, getAllNguoiLienHe);
router.put("/:id",verifyToken, updateNguoiLienHe)


module.exports = router;