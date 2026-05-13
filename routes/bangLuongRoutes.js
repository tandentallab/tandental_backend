const express = require("express");

const router = express.Router();

const {
  createBangLuong,
  getAllBangLuong,
  getBangLuongById,
  deleteBangLuong,
  deleteBangLuongByMonthYear
} = require("../controllers/bangLuongController");

router.post("/", createBangLuong);

router.get("/", getAllBangLuong);

router.get("/:id", getBangLuongById);

router.delete(
  "/",
  deleteBangLuongByMonthYear
);

router.delete("/:id", deleteBangLuong);

module.exports = router;