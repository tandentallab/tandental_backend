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
        giaTriHoaDon: { type: Number, default: 0 },
        daTTruocLanNay: { type: Number, default: 0 },
        conLaiTruocLanNay: { type: Number, default: 0 },
      },
    ],

    // 🔥 TRƯỜNG QUAN TRỌNG: Lưu số tiền đã trừ vào nợ migrate
    tienTruVaoMigrate: {
      type: Number,
      default: 0
    },

    nguoiTao: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },

    ngayThu: {
      type: Date,
      required: true,
    },

    soTienThu: {
      type: Number,
      required: true,
      min: 0,
    },

    duocKhauTru: {
      type: Number,
      default: 0,
      min: 0,
    },

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

// Tự động tạo mã phiếu thu
phieuThuSchema.pre("save", async function (next) {
  if (this.soPhieuThu) return;

  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `TAN${yy}${mm}`;

  const lastPhieuThu = await mongoose
    .model("PhieuThu")
    .findOne({ soPhieuThu: { $regex: `^${prefix}` } })
    .sort({ soPhieuThu: -1 });

  let nextNumber = 1; // Bắt đầu từ 0001
  if (lastPhieuThu?.soPhieuThu) {
    const lastNumber = parseInt(lastPhieuThu.soPhieuThu.slice(-4), 10);
    if (Number.isFinite(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  this.soPhieuThu = `${prefix}${String(nextNumber).padStart(4, "0")}`;
});

module.exports = mongoose.model("PhieuThu", phieuThuSchema);