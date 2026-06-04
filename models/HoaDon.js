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
      enum: ["Lưu tạm", "Chưa thanh toán", "Thanh toán một phần", "Đã thanh toán"],
      default: "Lưu tạm", // Mặc định sinh ra là Lưu tạm
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

// 🔥 THÊM MỚI: Tối ưu cho API getHoaDonById (Tính nợ đầu kỳ siêu tốc)
// Cover chính xác query: lọc theo nhaKhoa, trangThai, và so sánh ngày xuất/createdAt
hoaDonSchema.index({ nhaKhoa: 1, trangThai: 1, ngayXuatHoaDon: -1, createdAt: -1 });

// 🔥 THÊM MỚI: Tối ưu cho API getAllHoaDonAdmin (List & Phân trang)
// Cover cho bộ lọc trạng thái và sắp xếp mặc định
hoaDonSchema.index({ trangThai: 1, ngayXuatHoaDon: -1, createdAt: -1 });

hoaDonSchema.pre("save", function () {
  // 1. Tính toán số tiền Còn lại
  this.conLai = Math.round(Number(this.giaTriThanhToan || 0) - Number(this.daThanhToan || 0));

  // 2. Chốt trạng thái (Bỏ qua nếu đang là Lưu tạm)
  if (this.trangThai !== "Lưu tạm") {
    if (this.conLai <= 0) {
      this.trangThai = "Đã thanh toán";
    } else if (this.daThanhToan > 0) {
      this.trangThai = "Thanh toán một phần";
    } else {
      this.trangThai = "Chưa thanh toán";
    }
  }
});

module.exports = mongoose.model("HoaDon", hoaDonSchema);