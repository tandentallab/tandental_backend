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

    // Khoảng thời gian (chu kỳ) gom đơn hàng để xuất hóa đơn tổng
    tuNgay: {
      type: Date,
      required: [true, "Vui lòng chọn ngày bắt đầu chu kỳ"],
    },
    denNgay: {
      type: Date,
      required: [true, "Vui lòng chọn ngày kết thúc chu kỳ"],
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
        loaiGiamGia: {
          type: String,
          enum: ['phanTram', 'tienMat'],
          default: 'phanTram'
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
    // tongCong        = Σ tongCongSanPham (Phát sinh thuần trong tháng này)
    // chietKhau       = số tiền chiết khấu (tính từ tongCong)
    // thue            = (tongCong - chietKhau) × %  → lưu số tiền
    // giaTriThanhToan = TỔNG TIỀN CẦN THANH TOÁN (Đã bao gồm: Phát sinh tháng này + Nợ đầu kỳ gối đầu)
    tongCong: { type: Number, default: 0 },
    chietKhau: { type: Number, default: 0 },
    thue: { type: Number, default: 0 },
    chiPhiKhac: { type: Number, default: 0 },



    // UI truyền xuống: giaTriThanhToan = (tongCong - chietKhau) + thue + chiPhiKhac
    giaTriThanhToan: { type: Number, default: 0 },

    // Tổng số tiền lũy kế đã trả cho đợt công nợ này (bao gồm nhiều lần tạo phiếu thu)
    daThanhToan: { type: Number, default: 0 },

    // Còn lại phải thanh toán (Công thức: giaTriThanhToan - daThanhToan)
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

// Tối ưu hóa tốc độ truy vấn lọc hóa đơn theo chu kỳ kế toán
hoaDonSchema.index({ nhaKhoa: 1, denNgay: -1 });

hoaDonSchema.pre("save", function () {
  // 1. Còn lại = TỔNG giá trị (đã bao gồm nợ cũ) - Đã thanh toán
  this.conLai = Math.round(Number(this.giaTriThanhToan || 0) - Number(this.daThanhToan || 0));



  // 3. Trạng thái
  if (this.conLai <= 0) {
    this.trangThai = "Đã thanh toán";
  } else if (this.daThanhToan > 0) {
    this.trangThai = "Thanh toán một phần";
  } else {
    this.trangThai = "Chưa thanh toán";
  }
});

module.exports = mongoose.model("HoaDon", hoaDonSchema);