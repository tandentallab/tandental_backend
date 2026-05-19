const mongoose = require("mongoose");

const truongSchema = new mongoose.Schema({
  loaiTruong: {
    type: String,
    enum: [
        "maThe", 
        "nhaKhoa", 
        "bacSi", 
        "benhNhan", 
        "sanPham", 
        "viTriRang", 
        "baoHanhTu", 
        "baoHanhDen", 
        "maQR"
      ],
    required: true,
  },
  leTrai: { type: Number, default: 0 }, // mm
  leTren: { type: Number, default: 0 }, // mm
  coChu: { type: Number, default: 10 }, // pt
  doDam: { type: Boolean, default: false }, // bold
  nghieng: { type: Boolean, default: false }, // italic
  gachChan: { type: Boolean, default: false }, // underline
});

const mauTheBaoHanhSchema = new mongoose.Schema(
  {
    tenMau: {
      type: String,
      required: true,
      trim: true,
    },
    moTa: {
      type: String,
      default: "",
    },
    cacTruong: [truongSchema],
    trangThai: {
      type: Boolean,
      default: true,
    },
    nhaKhoa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NhaKhoa",
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MauTheBaoHanh", mauTheBaoHanhSchema);
