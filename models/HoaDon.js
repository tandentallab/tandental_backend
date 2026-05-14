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

const Counter = require("./Counter");

hoaDonSchema.pre("save", async function () {
  if (!this.isNew || this.soHoaDon) {
    return;
  }

  const now = new Date();

  // TAN + yy + mm
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `TAN${yy}${mm}`;

  const counterId = `HD${prefix}`;

  const counter =
    await Counter.findByIdAndUpdate(
      counterId,
      {
        $inc: { seq: 1 },
      },
      {
        new: true,
        upsert: true,
      }
    );

  const abcd = String(counter.seq).padStart(
    4,
    "0"
  );

  this.soHoaDon = `${counterId}${abcd}`;
});

/* ================= INDEX ================= */


hoaDonSchema.index({
  nhaKhoa: 1,
  createdAt: -1,
});

hoaDonSchema.index({
  trangThai: 1,
});

hoaDonSchema.index({
  ngayXuatHoaDon: -1,
});

module.exports = mongoose.model(
  "HoaDon",
  hoaDonSchema
);