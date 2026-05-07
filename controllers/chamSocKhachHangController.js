const ChamSocKhachHang = require("../models/chamSocKhachHang");

// ➕ Tạo chăm sóc
exports.createChamSoc = async (req, res) => {
  try {
    const payload = { ...req.body };

    // 🔥 Fix datetime (tránh lệch giờ)
    if (payload.ngayHenTiep) {
      payload.ngayHenTiep = new Date(payload.ngayHenTiep);
    }

    const data = await ChamSocKhachHang.create(payload);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📄 Lấy theo nha khoa
exports.getChamSocByNhaKhoa = async (req, res) => {
  try {
    const data = await ChamSocKhachHang.find({
      nhaKhoaId: req.params.nhaKhoaId,
    })
      .sort({ createdAt: -1 })
      .populate("staffId", "name");

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✏️ Update
exports.updateChamSoc = async (req, res) => {
  try {
    const payload = { ...req.body };

    if (payload.ngayHenTiep) {
      payload.ngayHenTiep = new Date(payload.ngayHenTiep);
    }

    const data = await ChamSocKhachHang.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );

    if (!data) {
      return res.status(404).json({ message: "Không tìm thấy dữ liệu" });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ❌ Delete
exports.deleteChamSoc = async (req, res) => {
  try {
    const data = await ChamSocKhachHang.findByIdAndDelete(req.params.id);

    if (!data) {
      return res.status(404).json({ message: "Không tìm thấy dữ liệu" });
    }

    res.json({ message: "Đã xóa thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔔 Lấy lịch cần chăm sóc hôm nay
exports.getChamSocHomNay = async (req, res) => {
  try {
    const today = new Date();

    const start = new Date(today.setHours(0, 0, 0, 0));
    const end = new Date(today.setHours(23, 59, 59, 999));

    const data = await ChamSocKhachHang.find({
      ngayHenTiep: { $gte: start, $lte: end },
    }).populate("nhaKhoaId", "hoVaTen");

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};