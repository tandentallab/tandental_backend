const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },

    hoTenNhanVien: String,

    action: {
      type: String,
      required: true,
    },

    module: {
      type: String,
      required: true,
    },

    targetId: String,

    targetName: String,

    description: String,

    oldData: Object,

    newData: Object,

    ipAddress: String,

    userAgent: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ActivityLog", activityLogSchema);