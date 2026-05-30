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
    soDuDauKy: [
      {
        thang: { type: Number, required: true },
        nam: { type: Number, required: true },
        soTien: { type: Number, default: 0 },
      }
    ],
    ghiChuThang: [
      {
        thang: { type: Number, required: true },
        nam: { type: Number, required: true },
        noiDung: { type: String, default: '' },
      }
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("NhaKhoa", nhaKhoaSchema);