const express = require("express");
const router = express.Router();

const {
  createNguoiLienHe,
  getAllNguoiLienHe,
  updateNguoiLienHe,
} = require("../controllers/nguoiLienHeController");

const { verifyToken, checkPermission } = require("../middleware/authMiddleware");


router.post("/",verifyToken, checkPermission, createNguoiLienHe);
router.get("/",verifyToken, checkPermission, getAllNguoiLienHe);
router.put("/:id",verifyToken, checkPermission, updateNguoiLienHe)


module.exports = router;