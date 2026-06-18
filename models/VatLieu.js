const mongoose = require("mongoose");

const vatLieuSchema = new mongoose.Schema(
  {
    maVatLieu: { type: String, required: true, unique: true, trim: true },
    tenVatLieu: { type: String, required: true, trim: true },
    nhaCungCap: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NhaCungCap",
      default: null,
    },
    soLuong: { type: Number, default: 0, min: 0 },       // Tồn kho thực tế
    tonKhoToiThieu: { type: Number, default: 0, min: 0 }, // Quy định tồn kho tối thiểu
    tonKhoToiDa: { type: Number, default: 0, min: 0 },    // Quy định tồn kho tối đa
    loaiVatLieu: { type: String, default: "" },            // Loại vật liệu
    nhomVatLieu: { type: String, default: "" },            // Nhóm vật liệu
    formRang: { type: String, default: "" },               // Form răng
    mauRang: { type: String, default: "" },                // Màu răng
    giaMua: { type: Number, default: 0, min: 0 },          // Giá mua
    donViTinh: { type: String, default: "" },
    ghiChu: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VatLieu", vatLieuSchema);
