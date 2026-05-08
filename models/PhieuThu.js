const mongoose = require("mongoose");

const phieuThuSchema = new mongoose.Schema(
  {
    hoaDon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HoaDon",
      required: true,
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

module.exports = mongoose.model("PhieuThu", phieuThuSchema);