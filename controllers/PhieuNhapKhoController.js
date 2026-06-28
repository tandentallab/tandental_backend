const PhieuNhapKho = require("../models/PhieuNhapKho");
const VatLieu = require("../models/VatLieu");

exports.getAll = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // ── Bộ lọc ──────────────────────────────────────────────
        const filter = {};

        // Tìm theo số phiếu (không phân biệt hoa thường)
        if (req.query.soPhieu) {
            filter.soPhieu = { $regex: req.query.soPhieu, $options: "i" };
        }

        // Lọc theo trạng thái
        if (req.query.trangThai) {
            filter.trangThai = req.query.trangThai;
        }

        // Lọc theo người tạo
        if (req.query.nguoiTao) {
            filter.nguoiTao = { $regex: req.query.nguoiTao, $options: "i" };
        }

        // Lọc theo khoảng ngày
        if (req.query.tuNgay || req.query.denNgay) {
            filter.ngayTao = {};
            if (req.query.tuNgay) filter.ngayTao.$gte = new Date(req.query.tuNgay);
            if (req.query.denNgay) {
                const den = new Date(req.query.denNgay);
                den.setHours(23, 59, 59, 999);
                filter.ngayTao.$lte = den;
            }
        }

        const total = await PhieuNhapKho.countDocuments(filter);

        const phieuNhapKhos = await PhieuNhapKho.find(filter)
            .select("ngayTao soPhieu trangThai nguoiTao ghiChu danhSachVatLieu")
            .populate("danhSachVatLieu.vatLieu", "tenVatLieu")
            .populate("danhSachVatLieu.nhaCungCap", "ten")
            .sort({ ngayTao: -1 })
            .skip(skip)
            .limit(limit);

        const data = phieuNhapKhos.map((phieu) => {
            const tongTien = phieu.danhSachVatLieu.reduce(
                (sum, item) => sum + (item.thanhTien || 0), 0
            );
            return { ...phieu.toObject(), tongTien };
        });

        res.status(200).json({ success: true, data, total, page, limit });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách phiếu nhập kho",
            error: error.message,
        });
    }
};

exports.getById = async (req, res) => {
    try {
        const phieuNhapKho = await PhieuNhapKho.findById(req.params.id)
            .populate("danhSachVatLieu.vatLieu", "tenVatLieu maVatLieu donViTinh giaMua")
            .populate("danhSachVatLieu.nhaCungCap", "ten");

        if (!phieuNhapKho) {
            return res.status(404).json({ success: false, message: "Phiếu nhập kho không tồn tại" });
        }

        res.status(200).json({ success: true, data: phieuNhapKho });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy phiếu nhập kho",
            error: error.message,
        });
    }
};

exports.create = async (req, res) => {
    try {
        const { danhSachVatLieu, ghiChu, nguoiTao } = req.body;

        const newPhieu = new PhieuNhapKho({ danhSachVatLieu, ghiChu, nguoiTao });
        const saved = await newPhieu.save();

        res.status(201).json({ success: true, data: saved });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi tạo phiếu nhập kho",
            error: error.message,
        });
    }
};

// Cập nhật nội dung phiếu (chỉ được sửa khi còn "Chưa nhận")
// Hoặc cập nhật trạng thái → "Đã nhận" thì cộng tồn kho
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { trangThai, ghiChu, danhSachVatLieu } = req.body;

        const phieu = await PhieuNhapKho.findById(id);
        if (!phieu) {
            return res.status(404).json({ success: false, message: "Phiếu nhập kho không tồn tại" });
        }

        // Không cho sửa nội dung phiếu đã nhận
        if (phieu.trangThai === "Đã nhận" && danhSachVatLieu) {
            return res.status(400).json({
                success: false,
                message: "Không thể chỉnh sửa phiếu đã nhận hàng",
            });
        }

        // Chuyển sang "Đã nhận" → cộng tồn kho
        if (trangThai === "Đã nhận" && phieu.trangThai === "Chưa nhận") {
            const list = danhSachVatLieu || phieu.danhSachVatLieu;
            const bulkOps = list.map((item) => ({
                updateOne: {
                    filter: { _id: item.vatLieu },
                    update: { $inc: { soLuong: item.soLuong } },
                },
            }));
            if (bulkOps.length > 0) await VatLieu.bulkWrite(bulkOps);
        }

        if (trangThai !== undefined) phieu.trangThai = trangThai;
        if (ghiChu !== undefined) phieu.ghiChu = ghiChu;
        if (danhSachVatLieu !== undefined) phieu.danhSachVatLieu = danhSachVatLieu;

        const updated = await phieu.save();
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi cập nhật phiếu nhập kho",
            error: error.message,
        });
    }
};

// Chỉ xóa được phiếu "Chưa nhận"
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const phieu = await PhieuNhapKho.findById(id);
        if (!phieu) {
            return res.status(404).json({ success: false, message: "Phiếu nhập kho không tồn tại" });
        }
        if (phieu.trangThai === "Đã nhận") {
            return res.status(400).json({
                success: false,
                message: "Không thể xóa phiếu đã nhận hàng",
            });
        }

        await PhieuNhapKho.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Xóa phiếu nhập kho thành công" });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa phiếu nhập kho",
            error: error.message,
        });
    }
};