const NhanVien = require("../models/NhanVien");
const fs = require("fs");
const path = require("path");

// ================= TẠO NHÂN VIÊN =================
exports.createNhanVien = async (req, res) => {
  try {
    // Ép kiểu ngayCongThang về số nếu có gửi lên, nếu không mongoose sẽ tự lấy mặc định (28)
    if (req.body.ngayCongThang) {
      req.body.ngayCongThang = Number(req.body.ngayCongThang);
    }

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

// ================= LẤY DANH SÁCH =================
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

// ================= CHI TIẾT NHÂN VIÊN =================
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

// ================= CẬP NHẬT NHÂN VIÊN =================
exports.updateNhanVien = async (req, res) => {
  try {
    // Bảo vệ dữ liệu: Ép kiểu sang Number nếu người dùng cập nhật số ngày công
    if (req.body.ngayCongThang !== undefined) {
      req.body.ngayCongThang = Number(req.body.ngayCongThang);
    }

    const data = await NhanVien.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after', runValidators: true } // runValidators giúp validate đúng schema (ví dụ: không được để trống)
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

// ================= XÓA NHÂN VIÊN =================
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

// ================= UPLOAD CCCD =================
exports.uploadCCCD = async (req, res) => {
  try {
    const { id } = req.params;

    const nhanVien = await NhanVien.findById(id);

    if (!nhanVien) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy nhân viên",
      });
    }

    // Lấy danh sách file upload
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
      success: false,
      message: err.message,
    });
  }
};

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

    // Kiểm tra ảnh tồn tại trong db
    if (!nhanVien.cccdImages.includes(imageUrl)) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy ảnh CCCD",
      });
    }

    // ================= XÓA FILE TRONG THƯ MỤC PUBLIC =================
    const filePath = path.join(
      __dirname,
      "../public",
      imageUrl.replace("/uploads", "uploads")
    );

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