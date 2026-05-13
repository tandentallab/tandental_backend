const express = require("express");

const router = express.Router();

const {
  createNhanVien,
  getAllNhanVien,
  getNhanVienById,
  updateNhanVien,
  deleteNhanVien,
} = require("../controllers/nhanVienController");

router.post("/", createNhanVien);

router.get("/", getAllNhanVien);

router.get("/:id", getNhanVienById);

router.put("/:id", updateNhanVien);

router.delete("/:id", deleteNhanVien);

module.exports = router;