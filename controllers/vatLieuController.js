const VatLieu = require("../models/VatLieu");

exports.createVatLieu = async (req, res) => {
  try {
    const data = await VatLieu.create(req.body);
    const populated = await VatLieu.findById(data._id).populate("nhaCungCap");
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ message: "Mã vật liệu đã tồn tại" });
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /kho/vat-lieu
 * Query params (tất cả đều optional):
 *   - page        : số trang, bắt đầu từ 1 (default: 1)
 *   - limit       : số bản ghi mỗi trang (default: 20)
 *   - search      : tìm theo maVatLieu, tenVatLieu, loaiVatLieu, nhomVatLieu, formRang, mauRang, donViTinh
 *   - nhaCungCap  : lọc theo _id nhà cung cấp
 *   - nhomVatLieu : lọc chính xác theo nhóm
 *   - loaiVatLieu : lọc chính xác theo loại
 *   - trangThai   : "thieu" | "du" — so sánh soLuong vs tonKhoToiThieu
 */
exports.getAllVatLieu = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // ── Build filter ──────────────────────────────────────────────────────
    const filter = {};

    // Tìm kiếm full-text đơn giản (regex)
    if (req.query.search?.trim()) {
      const kw = req.query.search.trim();
      const re = new RegExp(kw, "i");
      filter.$or = [
        { maVatLieu: re },
        { tenVatLieu: re },
        { loaiVatLieu: re },
        { nhomVatLieu: re },
        { formRang: re },
        { mauRang: re },
        { donViTinh: re },
      ];
    }

    if (req.query.nhaCungCap) {
      filter.nhaCungCap = req.query.nhaCungCap;
    }

    if (req.query.nhomVatLieu) {
      filter.nhomVatLieu = req.query.nhomVatLieu;
    }

    if (req.query.loaiVatLieu) {
      filter.loaiVatLieu = req.query.loaiVatLieu;
    }

    // Lọc tình trạng tồn kho bằng $expr (so sánh hai field)
    if (req.query.trangThai === "thieu") {
      // soLuong < tonKhoToiThieu
      filter.$expr = { $lt: ["$soLuong", "$tonKhoToiThieu"] };
    } else if (req.query.trangThai === "du") {
      // soLuong >= tonKhoToiThieu
      filter.$expr = { $gte: ["$soLuong", "$tonKhoToiThieu"] };
    }

    // ── Query ─────────────────────────────────────────────────────────────
    const [data, total] = await Promise.all([
      VatLieu.find(filter)
        .populate("nhaCungCap", "ten soDienThoai email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      VatLieu.countDocuments(filter),
    ]);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateVatLieu = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await VatLieu.findByIdAndUpdate(id, req.body, {
      returnDocument: "after",
      runValidators: true,
      new: true,
    }).populate("nhaCungCap", "ten soDienThoai email");
    if (!updated)
      return res.status(404).json({ message: "Không tìm thấy vật liệu" });
    res.json(updated);
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ message: "Mã vật liệu đã tồn tại" });
    res.status(500).json({ message: err.message });
  }
};

exports.deleteVatLieu = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await VatLieu.findByIdAndDelete(id);
    if (!deleted)
      return res.status(404).json({ message: "Không tìm thấy vật liệu" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /kho/vat-lieu
 * Body: { ids: string[] } — xóa nhiều vật liệu cùng lúc
 */
exports.deleteVatLieuMany = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Danh sách ID không hợp lệ" });
    }
    const result = await VatLieu.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
