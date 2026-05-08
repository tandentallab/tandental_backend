const PhieuBaoHanh = require("../models/PhieuBaoHanh");

// [POST] Tạo phiếu bảo hành
exports.createPhieuBaoHanh = async (req, res) => {
  try {
    const { donHang } = req.body;

    // Tạo mã bảo hành từ mã đơn hàng
    const donHangRecord = await require("../models/DonHang").findById(donHang);
    if (!donHangRecord) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const idStr = donHangRecord._id.toString();
    const maBaoHanh = `TAN${idStr.substring(idStr.length - 8).toUpperCase()}`;

    const newPhieuBaoHanh = new PhieuBaoHanh({
      ...req.body,
      maBaoHanh,
    });

    await newPhieuBaoHanh.save();

    const populatedPhieu = await newPhieuBaoHanh.populate([
      { path: "donHang" },
      { path: "nhaKhoa" },
      { path: "bacSi", select: "hoVaTen soDienThoai" },
      { path: "benhNhan", select: "hoVaTen soDienThoai" },
      { path: "sanPham", select: "tenSanPham donGiaChung" },
    ]);

    res.status(201).json({
      success: true,
      message: "Tạo phiếu bảo hành thành công",
      data: populatedPhieu,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo phiếu bảo hành",
      error: error.message,
    });
  }
};

// [GET] Lấy tất cả phiếu bảo hành
exports.getAllPhieuBaoHanh = async (req, res) => {
  try {
    const phieus = await PhieuBaoHanh.find()
      .populate("donHang")
      .populate("nhaKhoa", "hoVaTen tenGiaoDich")
      .populate("bacSi", "hoVaTen soDienThoai")
      .populate("benhNhan", "hoVaTen soDienThoai")
      .populate("sanPham", "tenSanPham donGiaChung")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: phieus.length,
      data: phieus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách phiếu bảo hành",
      error: error.message,
    });
  }
};

// [GET] Lấy phiếu bảo hành theo đơn hàng
exports.getPhieuBaoHanhByDonHang = async (req, res) => {
  try {
    const { donHangId } = req.params;

    const phieus = await PhieuBaoHanh.find({ donHang: donHangId })
      .populate("donHang")
      .populate("nhaKhoa", "hoVaTen tenGiaoDich")
      .populate("bacSi", "hoVaTen soDienThoai")
      .populate("benhNhan", "hoVaTen soDienThoai")
      .populate("sanPham", "tenSanPham donGiaChung");

    res.status(200).json({
      success: true,
      data: phieus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy phiếu bảo hành",
      error: error.message,
    });
  }
};

// [GET] Lấy chi tiết phiếu bảo hành
exports.getPhieuBaoHanhById = async (req, res) => {
  try {
    const phieu = await PhieuBaoHanh.findById(req.params.id)
      .populate("donHang")
      .populate("nhaKhoa")
      .populate("bacSi", "hoVaTen soDienThoai")
      .populate("benhNhan", "hoVaTen soDienThoai")
      .populate("sanPham", "tenSanPham donGiaChung");

    if (!phieu) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành" });
    }

    res.status(200).json({ success: true, data: phieu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// [PUT] Cập nhật phiếu bảo hành
exports.updatePhieuBaoHanh = async (req, res) => {
  try {
    const updatedPhieu = await PhieuBaoHanh.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: "after" }
    )
      .populate("donHang")
      .populate("nhaKhoa")
      .populate("bacSi", "hoVaTen soDienThoai")
      .populate("benhNhan", "hoVaTen soDienThoai")
      .populate("sanPham", "tenSanPham donGiaChung");

    if (!updatedPhieu) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành" });
    }

    res.status(200).json({ success: true, data: updatedPhieu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// [DELETE] Xóa phiếu bảo hành
exports.deletePhieuBaoHanh = async (req, res) => {
  try {
    const deletedPhieu = await PhieuBaoHanh.findByIdAndDelete(req.params.id);
    if (!deletedPhieu) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành" });
    }
    res.status(200).json({ success: true, message: "Xóa phiếu bảo hành thành công" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
