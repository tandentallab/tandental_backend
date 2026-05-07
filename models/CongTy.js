const mongoose = require("mongoose");

const congTySchema = new mongoose.Schema(
  {
    Ten: { 
      type: String, 
      required: true,
      default: "CÔNG TY TNHH TÂN DENTAL"
    },
    GioiThieu: { 
      type: String, 
      default: "" 
    },
    Website: { 
      type: String, 
      default: "" 
    },
    Email: { 
      type: String, 
      default: "" 
    },
    DienThoai: { 
      type: String, 
      default: "" 
    },
    DiaChi: { 
      type: String, 
      default: "" 
    },
    Avatar: { 
      type: String, 
      default: "" 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CongTy", congTySchema, "congtys");
