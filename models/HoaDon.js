const mongoose = require("mongoose");

const hoaDonSchema = new mongoose.Schema(
  {

    nhaKhoa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NhaKhoa",
      required: true,
    },

    danhSachDonHang: [
      {
        donHang: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DonHang",
          required: true,
        },
        tongTien: Number,
        chietKhau: {
          type: Number,
          default: 0,
        },
        loaiChietKhau: {
          type: String,
          enum: ["phanTram", "tienMat"],
          default: "tienMat",
        },
        thanhTienSauCK: Number,
      },
    ],

    tongTien: Number,
    tongChietKhau: Number,
    thanhTien: Number,

    ngayXuatHoaDon: {
      type: Date,
      default: Date.now,
    },

    daThanhToan: {
      type: Number,
      default: 0,
    },

    conLai: {
      type: Number,
      default: 0,
    },

    trangThai: {
      type: String,
      enum: ["Chưa thanh toán", "Thanh toán một phần", "Đã thanh toán"],
      default: "Chưa thanh toán",
    },
  },
  { timestamps: true }
);

// ✅ BẮT BUỘC PHẢI CÓ
module.exports = mongoose.model("HoaDon", hoaDonSchema);