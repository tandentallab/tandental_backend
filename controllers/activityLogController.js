const ActivityLog = require("../models/ActivityLog");


// ================= GET ALL ACTIVITY LOGS =================
exports.getActivityLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      action,
      module,
      staffId,
      search,
      fromDate,
      toDate,
    } = req.query;

    const filter = {};

    // Filter action
    if (action) {
      filter.action = action;
    }

    // Filter module
    if (module) {
      filter.module = module;
    }

    // Filter nhân viên
    if (staffId) {
      filter.staff = staffId;
    }

    // Filter ngày
    if (fromDate || toDate) {
      filter.createdAt = {};

      if (fromDate) {
        filter.createdAt.$gte = new Date(fromDate);
      }

      if (toDate) {
        filter.createdAt.$lte = new Date(toDate);
      }
    }

    // Search description
    if (search) {
      filter.$or = [
        {
          description: {
            $regex: search,
            $options: "i",
          },
        },
        {
          targetName: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const total = await ActivityLog.countDocuments(filter);

    const logs = await ActivityLog.find(filter)
      .populate("staff", "HoTenNV Email MSNV")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,

      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },

      data: logs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};