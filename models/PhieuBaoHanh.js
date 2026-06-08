const mongoose = require("mongoose");

const phieuBaoHanhSchema = new mongoose.Schema(
  {
    // Một phiếu bảo hành cho mỗi đơn hàng
    donHang: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DonHang",
      required: true,
      unique: true, // Mỗi đơn hàng chỉ có 1 phiếu bảo hành
    },
    maBaoHanh: {
      type: String,
      required: true,
      unique: true,
    },
    maQR: {
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
      ref: "NguoiLienHe",
    },
    benhNhan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BenhNhan",
      required: true,
    },
    // Danh sách sản phẩm bảo hành - mỗi sản phẩm có thể có thời gian bảo hành khác nhau
    danhSachBaoHanh: [
      {
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
        mau: String, // Màu sản phẩm
        tenSanPhamBaoHanh: {
          type: String,
          default: "",
        },
        baoHanhTu: {
          type: Date,
          required: true,
        },
        baoHanhDen: {
          type: Date,
          required: true,
        },
      },
    ],
    mauThe: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "MauTheBaoHanh" 
    },
    soDienThoai: String,
    ghiChu: String,
    nhakhoabh: {
      type: String,
      default: "",
    },
    bacsibh: {
      type: String,
      default: "",
    },
    benhnhanbh: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PhieuBaoHanh", phieuBaoHanhSchema);
