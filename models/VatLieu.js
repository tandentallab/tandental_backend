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
    donViTinh: { type: String, default: "" },
    ghiChu: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VatLieu", vatLieuSchema);
