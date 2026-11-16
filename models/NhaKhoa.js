const mongoose = require("mongoose");

const nhaKhoaSchema = new mongoose.Schema(
  {
    // Id khách hàng bên CRM. CRM quản lý nha khoa (tạo mới, tên, SĐT, email,
    // địa chỉ, tỉnh); lab chỉ quản lý những gì sinh ra từ nha khoa (đơn hàng,
    // hoá đơn, công nợ...). Xem utils/nhaKhoaTuCrm.js.
    maCrm: String,
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

// Mỗi khách hàng CRM chỉ gắn với 1 nha khoa. Dùng partial index (không dùng
// sparse) để các nha khoa chưa liên kết không bị tính là trùng.
nhaKhoaSchema.index(
  { maCrm: 1 },
  { unique: true, partialFilterExpression: { maCrm: { $type: "string" } } }
);

module.exports = mongoose.model("NhaKhoa", nhaKhoaSchema);