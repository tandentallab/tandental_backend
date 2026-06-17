const mongoose = require("mongoose");

const nhaCungCapSchema = new mongoose.Schema(
  {
    ten: { type: String, required: true },
    diaChi: { type: String },
    soDienThoai: { type: String },
    email: { type: String },
    ghiChu: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NhaCungCap", nhaCungCapSchema);
