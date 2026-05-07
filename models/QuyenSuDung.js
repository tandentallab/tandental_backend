const mongoose = require("mongoose");

const quyenSuDungSchema = new mongoose.Schema(
  {
    ten: { type: String, required: true, unique: true },
    moTa: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuyenSuDung", quyenSuDungSchema);
