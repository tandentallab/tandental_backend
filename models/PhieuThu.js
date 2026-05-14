const mongoose = require("mongoose");

const phieuThuSchema = new mongoose.Schema(
  {
    soPhieuThu: {
      type: String,
      unique: true,
      index: true,
    },

    // Hỗ trợ nhiều hóa đơn trong một phiếu thu
    danhSachHoaDon: [
      {
        hoaDon: { type: mongoose.Schema.Types.ObjectId, ref: "HoaDon" },
        soTienThanhToan: { type: Number, default: 0 },
        // Snapshot tại thời điểm lập phiếu thu
        giaTriHoaDon: { type: Number, default: 0 },       // thanhTien lúc tạo
        daTTruocLanNay: { type: Number, default: 0 },     // daThanhToan TRƯỚC lần này
        conLaiTruocLanNay: { type: Number, default: 0 },  // conLai TRƯỚC lần này
      },
    ],

    nguoiTao: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },

    ngayThu: {
      type: Date,
      required: true,
    },

    ngayTao: {
      type: Date,
      default: Date.now,
    },

    soTienThu: {
      type: Number,
      required: true,
      min: 0,
    },

    // 🔥 TIỀN TRỪ VÀO HÓA ĐƠN
    duocKhauTru: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 🔥 TIỀN THỪA (nếu trả quá)
    conThua: {
      type: Number,
      default: 0,
    },

    noiDung: String,

    phuongThucThanhToan: {
      type: String,
      enum: ["Tiền mặt", "Chuyển khoản", "Khác"],
      default: "Tiền mặt",
    },
  },
  { timestamps: true }
);

phieuThuSchema.pre("save", async function () {
  if (!this.isNew || this.soPhieuThu) {
    return;
  }

  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `TAN${yy}${mm}`;

  const lastPhieuThu = await mongoose
    .model("PhieuThu")
    .findOne({ soPhieuThu: { $regex: `^${prefix}` } })
    .sort({ soPhieuThu: -1 })
    .select("soPhieuThu");

  let nextNumber = 0;
  if (lastPhieuThu?.soPhieuThu) {
    const lastNumber = parseInt(lastPhieuThu.soPhieuThu.slice(-4), 10);
    if (Number.isFinite(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  this.soPhieuThu = `${prefix}${String(nextNumber).padStart(4, "0")}`;
});

module.exports = mongoose.model("PhieuThu", phieuThuSchema);