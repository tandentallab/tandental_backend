const GhiChu = require("../models/GhiChu");
const DonHang = require("../models/DonHang");
const mongoose = require("mongoose");
const logActivity = require("../utils/activityLogger");

// ================= TẠO GHI CHÚ (TO-DO LIST) =================
exports.createGhiChu = async (req, res) => {
  try {
    const { maDonHang, noiDung, nguoiGhiChu } = req.body;

    if (!noiDung || !noiDung.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nội dung ghi chú là bắt buộc",
      });
    }

    let donHangId = null;
    let maDonHangNormalized = null;

    if (maDonHang && maDonHang.trim()) {
      const code = maDonHang.trim();
      let order = null;

      // 1. Check if it's a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(code)) {
        order = await DonHang.findById(code);
      }

      // 2. Check by maDonHang exact match
      if (!order) {
        order = await DonHang.findOne({ maDonHang: code });
      }

      // 3. Check by maDonHang case-insensitive match (allowing optional 'TAN' prefix)
      if (!order) {
        const cleanCode = code.toUpperCase().replace(/^TAN/, "");
        order = await DonHang.findOne({
          maDonHang: { $regex: new RegExp(`^(TAN)?${cleanCode}$`, "i") },
        });
      }

      // 4. Check by matching the last 8 digits of ObjectId (standard TAN suffix) or maDonHang suffix
      if (!order) {
        const cleanCode = code.toUpperCase().replace(/^TAN/, "");
        if (cleanCode.length === 8) {
          order = await DonHang.findOne({
            maDonHang: { $regex: new RegExp(`${cleanCode}$`, "i") },
          });

          if (!order) {
            const allOrders = await DonHang.find();
            order = allOrders.find((o) =>
              o._id.toString().toUpperCase().endsWith(cleanCode)
            );
          }
        }
      }

      if (order) {
        donHangId = order._id;
        maDonHangNormalized =
          order.maDonHang ||
          `TAN${order._id.toString().substring(order._id.toString().length - 8).toUpperCase()}`;
      } else {
        // Fallback: Store exactly what the user typed without ref
        maDonHangNormalized = code;
      }
    }

    const nguoiGhiChuNormalized = (nguoiGhiChu && nguoiGhiChu.trim()) ? nguoiGhiChu.trim() : "";

    const ghiChu = await GhiChu.create({
      donHang: donHangId,
      maDonHang: maDonHangNormalized,
      noiDung: noiDung.trim(),
      nguoiGhiChu: nguoiGhiChuNormalized,
      trangThai: "Chưa hoàn thành",
    });

    // Log activity
    await logActivity({
      req,
      action: "CREATE",
      module: "GhiChu",
      targetId: ghiChu._id.toString(),
      targetName: ghiChu.maDonHang || "Ghi chú chung",
      description: `Tạo ghi chú công việc: "${ghiChu.noiDung}" bởi ${ghiChu.nguoiGhiChu}`,
      newData: ghiChu,
    });

    res.status(201).json({
      success: true,
      data: ghiChu,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= LẤY DANH SÁCH GHI CHÚ =================
exports.getAllGhiChu = async (req, res) => {
  try {
    const data = await GhiChu.find()
      .populate({
        path: "donHang",
        select: "_id maDonHang nhaKhoa benhNhan",
        populate: [
          { path: "nhaKhoa", select: "tenGiaoDich hoVaTen" },
          { path: "benhNhan", select: "hoVaTen" },
        ],
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= XÓA GHI CHÚ (KHI HOÀN THÀNH) =================
exports.deleteGhiChu = async (req, res) => {
  try {
    const { id } = req.params;
    const ghiChu = await GhiChu.findById(id);

    if (!ghiChu) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy ghi chú",
      });
    }

    await GhiChu.findByIdAndDelete(id);

    // Log activity
    await logActivity({
      req,
      action: "DELETE",
      module: "GhiChu",
      targetId: id,
      targetName: ghiChu.maDonHang || "Ghi chú chung",
      description: `Hoàn thành và xóa ghi chú: "${ghiChu.noiDung}"`,
      oldData: ghiChu,
    });

    res.json({
      success: true,
      message: "Hoàn thành và xóa ghi chú thành công",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
