const mongoose = require("mongoose");

const nhanVienSchema = new mongoose.Schema(
  {
    hoVaTen: {
      type: String,
      required: true,
    },

    cccd: {
      type: String,
      required: true,
      unique: true,
    },

    diaChi: String,

    soDienThoai: String,

    email: String,

    chucVu: String,

    luongCanBan: {
      type: Number,
      required: true,
      default: 0,
    },

    ngayCongThang: {
      type: Number,
      required: true,
      default: 28,
    },

    trangThai: {
      type: String,
      enum: ["Đang làm", "Nghỉ việc"],
      default: "Đang làm",
    },

    cccdImages: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("NhanVien", nhanVienSchema);