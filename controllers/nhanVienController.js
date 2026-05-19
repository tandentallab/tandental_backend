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
      { returnDocument: 'after' }
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

//UPLOAD CCCD
exports.uploadCCCD = async (req, res) => {
  try {
    const { id } = req.params;

    const nhanVien = await NhanVien.findById(id);

    if (!nhanVien) {
      return res.status(404).json({
        message: "Không tìm thấy nhân viên",
      });
    }

    // lấy danh sách file upload
    const imageUrls = req.files.map(
      (file) => `/uploads/cccd/${file.filename}`
    );

    nhanVien.cccdImages = [
      ...(nhanVien.cccdImages || []),
      ...imageUrls,
    ];

    await nhanVien.save();

    res.json({
      success: true,
      message: "Upload CCCD thành công",
      data: nhanVien,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: err.message,
    });
  }
};

const fs = require("fs");
const path = require("path");

// ================= DELETE CCCD IMAGE =================
exports.deleteCCCDImage = async (req, res) => {
  try {
    const { id } = req.params;

    const { imageUrl } = req.body;

    const nhanVien = await NhanVien.findById(id);

    if (!nhanVien) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy nhân viên",
      });
    }

    // kiểm tra ảnh tồn tại
    if (!nhanVien.cccdImages.includes(imageUrl)) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy ảnh CCCD",
      });
    }

    // ================= XÓA FILE TRONG PUBLIC =================
    const filePath = path.join(
      __dirname,
      "../public",
      imageUrl.replace("/uploads", "uploads")
    );

    // nếu file tồn tại thì xóa
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // ================= XÓA TRONG DATABASE =================
    nhanVien.cccdImages = nhanVien.cccdImages.filter(
      (img) => img !== imageUrl
    );

    await nhanVien.save();

    res.json({
      success: true,
      message: "Xóa ảnh CCCD thành công",
      data: nhanVien,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};