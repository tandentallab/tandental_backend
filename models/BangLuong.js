const mongoose = require("mongoose");

const bangLuongSchema = new mongoose.Schema(
  {
    thang: {
      type: Number,
      required: true,
    },

    nam: {
      type: Number,
      required: true,
    },

    nhanVien: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NhanVien",
      required: true,
    },

    luongCanBan: Number,

    ngayCongThang: Number,   

    luongMotNgay: Number,

    soNgayCong: {
      type: Number,
      default: 0,
    },

    thanhTienCong: Number,

    phuCapCom: {
      type: Number,
      default: 0,
    },

    phuCapDienThoai: {
      type: Number,
      default: 0,
    },

    thuong: {
      type: Number,
      default: 0,
    },

    phat: {
      type: Number,
      default: 0,
    },

    ungTruoc: {
      type: Number,
      default: 0,
    },

    tongPhuCap: Number,

    tongLuong: Number,

    thucNhan: Number,

    ghiChu: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("BangLuong", bangLuongSchema);