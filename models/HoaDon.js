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

    thue: {
      type: Number,
      default: 0,
    },

    chiPhiKhac: {
      type: Number,
      default: 0,
    },

    trangThai: {
      type: String,
      enum: [
        "Chưa thanh toán",
        "Thanh toán một phần",
        "Đã thanh toán",
      ],
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

    ghiChuChoKhachHang: {
      type: String,
      default: "",
    },

    ghiChuNoiBo: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

/* ================= TỰ ĐỘNG TẠO SỐ HÓA ĐƠN ================= */

hoaDonSchema.pre("save", async function () {
  // chỉ tạo khi thêm mới
  if (!this.isNew || this.soHoaDon) {
    return;
  }

  const now = new Date();

  // TAN + yy + mm
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `TAN${yy}${mm}`;

  // tìm số hóa đơn lớn nhất tháng hiện tại
  const lastHoaDon = await mongoose
    .model("HoaDon")
    .findOne({
      soHoaDon: {
        $regex: `^${prefix}`,
      },
    })
    .sort({ soHoaDon: -1 });

  let nextNumber = 0;

  if (lastHoaDon?.soHoaDon) {
    const lastNumber = parseInt(
      lastHoaDon.soHoaDon.slice(-4)
    );

    if (Number.isFinite(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  // ABCD
  const abcd = String(nextNumber).padStart(4, "0");

  this.soHoaDon = `${prefix}${abcd}`;
});

module.exports = mongoose.model(
  "HoaDon",
  hoaDonSchema
);