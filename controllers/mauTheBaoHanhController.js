const MauTheBaoHanh = require("../models/MauTheBaoHanh");

// Lấy danh sách mẫu thẻ bảo hành
exports.getMauTheList = async (req, res) => {
  try {
    const { nhaKhoaId } = req.query;
    const query = nhaKhoaId ? { nhaKhoa: nhaKhoaId } : {};

    const mauTheList = await MauTheBaoHanh.find(query)
      .populate("nhaKhoa", "tenGiaoDich hoVaTen")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: mauTheList,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy chi tiết mẫu thẻ
exports.getMauTheById = async (req, res) => {
  try {
    const mauThe = await MauTheBaoHanh.findById(req.params.id).populate(
      "nhaKhoa",
      "tenGiaoDich hoVaTen"
    );

    if (!mauThe) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy mẫu thẻ bảo hành",
      });
    }

    res.status(200).json({
      success: true,
      data: mauThe,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Tạo mẫu thẻ mới
// Tạo mẫu thẻ mới
exports.createMauThe = async (req, res) => {
  try {
    const { tenMau, moTa, cacTruong, nhaKhoa } = req.body;

    // 👉 ĐÃ SỬA: Chỉ kiểm tra tenMau, bỏ qua nhaKhoa
    if (!tenMau) {
      return res.status(400).json({
        success: false,
        message: "Tên mẫu thẻ là bắt buộc",
      });
    }

    const mauThe = new MauTheBaoHanh({
      tenMau,
      moTa,
      cacTruong: cacTruong || [],
      nhaKhoa: nhaKhoa || undefined, // Nếu không truyền nhaKhoa thì bỏ qua
    });

    await mauThe.save();
    
    // Nếu có truyền nhaKhoa thì mới populate để tránh lỗi
    if (mauThe.nhaKhoa) {
        await mauThe.populate("nhaKhoa", "tenGiaoDich hoVaTen");
    }

    res.status(201).json({
      success: true,
      data: mauThe,
      message: "Tạo mẫu thẻ bảo hành thành công",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cập nhật mẫu thẻ
exports.updateMauThe = async (req, res) => {
  try {
    const { tenMau, moTa, cacTruong, trangThai } = req.body;

    // 1. Tìm bản ghi theo ID
    const mauThe = await MauTheBaoHanh.findById(req.params.id);

    if (!mauThe) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy mẫu thẻ bảo hành",
      });
    }


    // 3. Gán giá trị thủ công thay vì dùng findByIdAndUpdate
    mauThe.tenMau = tenMau;
    mauThe.moTa = moTa;
    mauThe.cacTruong = cacTruong; // Đảm bảo đây là một mảng object
    mauThe.trangThai = trangThai;

    // 4. Lưu lại
    await mauThe.save();

    // 5. Populate lại để trả về dữ liệu mới nhất
    await mauThe.populate("nhaKhoa", "tenGiaoDich hoVaTen");

    res.status(200).json({
      success: true,
      data: mauThe,
      message: "Cập nhật mẫu thẻ bảo hành thành công",
    });
  } catch (error) {
    console.error("Lỗi update mẫu thẻ:", error); // Xem lỗi cụ thể trong console server
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Xóa mẫu thẻ
exports.deleteMauThe = async (req, res) => {
  try {
    const mauThe = await MauTheBaoHanh.findByIdAndDelete(req.params.id);

    if (!mauThe) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy mẫu thẻ bảo hành",
      });
    }

    res.status(200).json({
      success: true,
      message: "Xóa mẫu thẻ bảo hành thành công",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
