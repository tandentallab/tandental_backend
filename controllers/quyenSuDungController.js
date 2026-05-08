const QuyenSuDung = require("../models/QuyenSuDung");

// 📌 Lấy tất cả Quyền sử dụng (bao gồm inactive - chỉ Admin)
exports.getAllQuyenSuDungIncludeInactive = async (req, res) => {
  try {
    const quyens = await QuyenSuDung.find().sort({ createdAt: -1 });
    res.status(200).json({ data: quyens });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 Restore Quyền sử dụng (set isActive = true)
exports.restoreQuyenSuDung = async (req, res) => {
  try {
    const { id } = req.params;

    const quyen = await QuyenSuDung.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    );

    if (!quyen) {
      return res.status(404).json({ message: "Quyền sử dụng không tồn tại" });
    }

    res.status(200).json({
      message: "Khôi phục quyền sử dụng thành công",
      data: quyen,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.createQuyenSuDung = async (req, res) => {
  try {
    const { ten, moTa } = req.body;

    if (!ten) {
      return res.status(400).json({ message: "Tên quyền sử dụng là bắt buộc" });
    }

    const quyenExists = await QuyenSuDung.findOne({ ten });
    if (quyenExists) {
      return res.status(400).json({ message: "Quyền sử dụng này đã tồn tại" });
    }

    const quyenSuDung = new QuyenSuDung({ ten, moTa });
    await quyenSuDung.save();

    res.status(201).json({
      message: "Tạo quyền sử dụng thành công",
      data: quyenSuDung,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 Lấy tất cả Quyền sử dụng (chỉ active)
exports.getAllQuyenSuDung = async (req, res) => {
  try {
    const quyens = await QuyenSuDung.find({ isActive: true }).sort({
      createdAt: -1,
    });
    res.status(200).json({ data: quyens });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 Lấy Quyền sử dụng theo ID
exports.getQuyenSuDungById = async (req, res) => {
  try {
    const { id } = req.params;
    const quyen = await QuyenSuDung.findById(id);

    if (!quyen) {
      return res.status(404).json({ message: "Quyền sử dụng không tồn tại" });
    }

    res.status(200).json({ data: quyen });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 Cập nhật Quyền sử dụng
exports.updateQuyenSuDung = async (req, res) => {
  try {
    const { id } = req.params;
    const { ten, moTa } = req.body;

    if (!ten) {
      return res.status(400).json({ message: "Tên quyền sử dụng là bắt buộc" });
    }

    // Kiểm tra xem tên đã tồn tại chưa (ngoại trừ bản ghi hiện tại)
    const existingQuyen = await QuyenSuDung.findOne({
      ten,
      _id: { $ne: id },
    });
    if (existingQuyen) {
      return res.status(400).json({ message: "Tên quyền sử dụng này đã tồn tại" });
    }

    const quyen = await QuyenSuDung.findByIdAndUpdate(
      id,
      { ten, moTa },
      { new: true, runValidators: true }
    );

    if (!quyen) {
      return res.status(404).json({ message: "Quyền sử dụng không tồn tại" });
    }

    res.status(200).json({
      message: "Cập nhật quyền sử dụng thành công",
      data: quyen,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 Xoá Quyền sử dụng (Soft Delete - set isActive = false)
exports.deleteQuyenSuDung = async (req, res) => {
  try {
    const { id } = req.params;

    const quyen = await QuyenSuDung.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!quyen) {
      return res.status(404).json({ message: "Quyền sử dụng không tồn tại" });
    }

    res.status(200).json({
      message: "Xoá quyền sử dụng thành công",
      data: quyen,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
