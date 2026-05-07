const mongoose = require("mongoose");

const nhaCungCapSchema = new mongoose.Schema(
  {
    ten_nha_cung_cap: { type: String, required: true },
    ten_giao_dich: { type: String },
    so_di_dong: { type: String },
    dien_thoai: { type: String },
    website: { type: String },
    quoc_gia: { type: String },
    tinh: { type: String },
    quan_huyen: { type: String },
    dia_chi: { type: String },
    mo_ta: { type: String },
    ngay_tao: { type: Date, default: Date.now },
    is_actived: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NhaCungCap", nhaCungCapSchema, "nhacungcaps");
