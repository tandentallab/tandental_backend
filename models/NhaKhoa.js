const mongoose = require("mongoose");

const nhaKhoaSchema = new mongoose.Schema(
  {
    hoVaTen: String,
    tenGiaoDich: String,
    soDienThoai: String,
    email: String,
    website: String,
    quocGia: String,
    tinh: String,
    quanHuyen: String,
    diaChiCuThe: String,
    moTa: String,
    soDuDauKy: {
      thang: { type: Number, default: null },
      nam: { type: Number, default: null },
      soTien: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NhaKhoa", nhaKhoaSchema);