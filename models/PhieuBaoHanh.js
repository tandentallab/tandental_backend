const mongoose = require("mongoose");

const phieuBaoHanhSchema = new mongoose.Schema(
  {
    donHang: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DonHang",
      required: true,
    },
    maBaoHanh: {
      type: String,
      required: true,
      unique: true,
    },
    nhaKhoa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NhaKhoa",
      required: true,
    },
    bacSi: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    benhNhan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BenhNhan",
      required: true,
    },
    sanPham: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SanPham",
      required: true,
    },
    viTriRang: String, // Vị trí răng
    soLuong: {
      type: Number,
      default: 1,
    },
    mau: String, // Màu thẻ
    mauTheTi: String, // Mẫu thẻ (Mẫu in Dbio, Mẫu in UNC, Mẫu thẻ Lab)
    baoHanhTu: {
      type: Date,
      required: true,
    },
    baoHanhDen: {
      type: Date,
      required: true,
    },
    soDienThoai: String,
    ghiChu: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("PhieuBaoHanh", phieuBaoHanhSchema);
