const mongoose = require("mongoose");

const chamSocKhachHangSchema = new mongoose.Schema(
  {
    nhaKhoaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NhaKhoa",
      required: true,
      index: true,
    },

    hinhThuc: {
      type: String,
      required: true,
      trim: true,
    },

    noiDung: {
      type: String,
      required: true,
      trim: true,
    },

    ketQua: {
      type: String,
      default: "",
    },

    ngayHenTiep: {
      type: Date, // ✅ DateTime chuẩn
    },

    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ChamSocKhachHang",
  chamSocKhachHangSchema
);