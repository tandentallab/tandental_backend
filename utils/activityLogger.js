const ActivityLog = require("../models/ActivityLog");

const logActivity = async ({
  req,
  action,
  module,
  targetId = "",
  targetName = "",
  description = "",
  oldData = null,
  newData = null,
}) => {
  try {
    await ActivityLog.create({
      staff: req.user.id,
      hoTenNhanVien: req.user.HoTenNV,

      action,
      module,

      targetId,
      targetName,

      description,

      oldData,
      newData,

      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  } catch (err) {
    console.error("Log activity error:", err.message);
  }
};

module.exports = logActivity;