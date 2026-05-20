const mongoose = require("mongoose");

const hoaDonSchema = new mongoose.Schema(
  {
    soHoaDon: {
      type: String,
      unique: true,
    },
    nhaKhoa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NhaKhoa",
      required: true,
    },

    danhSachSanPham: [
      {
        donHang: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DonHang",
          required: true,
        },
        sanPhamDonHangId: mongoose.Schema.Types.ObjectId, // _id subdoc trong DonHang
        sanPham: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SanPham",
          required: true,
        },
        tenSanPham: { type: String, default: "" },
        loaiDon: {
          type: String,
          enum: ["Mới", "Hàng sửa", "Hàng làm lại", "Hàng bảo hành"],
          default: "Mới",
        },
        viTri: [
          {
            kieu: {
              type: String,
              enum: ["Rời", "Cầu"],
            },
            soRang: [Number],
          },
        ],
        soLuong: {
          type: Number,
          required: true,
          default: 1,
        },
        donGia: {
          type: Number,
          default: 0,
        },
        thanhTien: {
          type: Number,
          default: 0, // soLuong × donGia
        },
        giamGia: {
          type: Number,
          default: 0,
        },
        tongCongSanPham: {
          type: Number,
          default: 0, // thanhTien - giamGia
        },
        ghiChu: {
          type: String,
          default: "",
        },
      },
    ],

    /* ================= TỔNG HÓA ĐƠN ================= */
    // tongCong        = Σ tongCongSanPham
    // chietKhau       = số tiền chiết khấu (tính từ tongCong)
    // thue            = (tongCong - chietKhau) × %  → lưu số tiền
    // giaTriThanhToan = (tongCong - chietKhau) + thue + chiPhiKhac
    // conLai          = giaTriThanhToan - daThanhToan
    tongCong: { type: Number, default: 0 },
    chietKhau: { type: Number, default: 0 },
    thue: { type: Number, default: 0 },
    chiPhiKhac: { type: Number, default: 0 },
    giaTriThanhToan: { type: Number, default: 0 },
    daThanhToan: { type: Number, default: 0 },
    conLai: { type: Number, default: 0 },

    ngayXuatHoaDon: { type: Date, default: Date.now },
    trangThai: {
      type: String,
      enum: ["Chưa thanh toán", "Thanh toán một phần", "Đã thanh toán"],
      default: "Chưa thanh toán",
    },
    chinhSachThanhToan: {
      type: String,
      enum: [
        "Thanh toán trước",
        "Thanh toán trong 7 ngày",
        "Thanh toán trong 10 ngày",
        "Thanh toán trong 30 ngày",
        "Thanh toán trong 60 ngày",
        "Thanh toán trong 90 ngày",
        "Thanh toán cuối tháng",
        "Thanh toán ngay",
      ],
      default: "Thanh toán cuối tháng",
    },
    ghiChuChoKhachHang: { type: String, default: "" },
    ghiChuNoiBo: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("HoaDon", hoaDonSchema);