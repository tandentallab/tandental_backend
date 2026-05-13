const NhanVien = require("../models/NhanVien");


// Tạo nhân viên
exports.createNhanVien = async (req, res) => {
  try {
    const nhanVien = await NhanVien.create(req.body);

    res.json({
      success: true,
      data: nhanVien,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// Lấy danh sách
exports.getAllNhanVien = async (req, res) => {
  try {
    const data = await NhanVien.find().sort({
      createdAt: -1,
    });

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


// Chi tiết
exports.getNhanVienById = async (req, res) => {
  try {
    const data = await NhanVien.findById(req.params.id);

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


// Cập nhật
exports.updateNhanVien = async (req, res) => {
  try {
    const data = await NhanVien.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

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


// Xóa
exports.deleteNhanVien = async (req, res) => {
  try {
    await NhanVien.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Xóa nhân viên thành công",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};