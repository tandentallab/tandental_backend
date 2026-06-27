const mongoose = require("mongoose");

const ghiChuSchema = new mongoose.Schema(
  {
    donHang: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DonHang",
      default: null,
    },
    maDonHang: {
      type: String,
      default: null,
    },
    noiDung: {
      type: String,
      required: true,
    },
    nguoiGhiChu: {
      type: String,
      default: "",
    },
    trangThai: {
      type: String,
      enum: ["Chưa hoàn thành", "Đã hoàn thành"],
      default: "Chưa hoàn thành",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GhiChu", ghiChuSchema);
