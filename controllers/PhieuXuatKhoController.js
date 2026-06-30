const PhieuXuatKho = require("../models/PhieuXuatKho");
const VatLieu = require("../models/VatLieu");

exports.getOptions = async (req, res) => {
    try {
        const [boPhanList, nhanVienList] = await Promise.all([
            PhieuXuatKho.distinct("boPhan"),
            PhieuXuatKho.distinct("nhanVien"),
        ]);
        res.json({
            success: true,
            data: {
                boPhanList: boPhanList.filter(Boolean).sort(),
                nhanVienList: nhanVienList.filter(Boolean).sort(),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAll = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};

        if (req.query.soPhieu) filter.soPhieu = { $regex: req.query.soPhieu, $options: "i" };
        if (req.query.trangThai) {
            const values = req.query.trangThai.split(",").filter(Boolean);
            filter.trangThai = values.length === 1 ? values[0] : { $in: values };
        }
        if (req.query.nhanVien) filter.nhanVien = { $regex: req.query.nhanVien, $options: "i" };
        if (req.query.boPhan) filter.boPhan = { $regex: req.query.boPhan, $options: "i" };

        if (req.query.tuNgay || req.query.denNgay) {
            filter.ngayTao = {};
            if (req.query.tuNgay) filter.ngayTao.$gte = new Date(req.query.tuNgay);
            if (req.query.denNgay) {
                const den = new Date(req.query.denNgay);
                den.setHours(23, 59, 59, 999);
                filter.ngayTao.$lte = den;
            }
        }

        const total = await PhieuXuatKho.countDocuments(filter);

        const phieuXuatKhos = await PhieuXuatKho.find(filter)
            .select("ngayTao soPhieu trangThai nhanVien boPhan ghiChu danhSachVatLieu")
            .populate("danhSachVatLieu.vatLieu", "tenVatLieu donViTinh")
            .sort({ ngayTao: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({ success: true, data: phieuXuatKhos, total, page, limit });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách phiếu xuất kho",
            error: error.message,
        });
    }
};

exports.getById = async (req, res) => {
    try {
        const phieuXuatKho = await PhieuXuatKho.findById(req.params.id)
            .populate("danhSachVatLieu.vatLieu", "tenVatLieu maVatLieu donViTinh soLuong");

        if (!phieuXuatKho) {
            return res.status(404).json({ success: false, message: "Phiếu xuất kho không tồn tại" });
        }

        res.status(200).json({ success: true, data: phieuXuatKho });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy phiếu xuất kho",
            error: error.message,
        });
    }
};

exports.create = async (req, res) => {
    try {
        const { danhSachVatLieu, ghiChu, boPhan, nhanVien } = req.body;

        const newPhieu = new PhieuXuatKho({ danhSachVatLieu, ghiChu, boPhan, nhanVien });
        const saved = await newPhieu.save();

        res.status(201).json({ success: true, data: saved });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi tạo phiếu xuất kho",
            error: error.message,
        });
    }
};

// Cập nhật nội dung phiếu (chỉ khi "Chưa xuất")
// Hoặc xác nhận xuất → "Đã xuất" thì trừ tồn kho
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { trangThai, ghiChu, danhSachVatLieu, boPhan, nhanVien } = req.body;

        const phieu = await PhieuXuatKho.findById(id);
        if (!phieu) {
            return res.status(404).json({ success: false, message: "Phiếu xuất kho không tồn tại" });
        }

        if (phieu.trangThai === "Đã xuất" && (danhSachVatLieu || boPhan || nhanVien)) {
            return res.status(400).json({
                success: false,
                message: "Không thể chỉnh sửa phiếu đã xuất hàng",
            });
        }

        // Chuyển sang "Đã xuất" → kiểm tra tồn kho rồi trừ
        if (trangThai === "Đã xuất" && phieu.trangThai === "Chưa xuất") {
            const list = danhSachVatLieu || phieu.danhSachVatLieu;

            for (const item of list) {
                const vl = await VatLieu.findById(item.vatLieu);
                if (!vl) {
                    return res.status(400).json({ success: false, message: "Vật liệu không tồn tại" });
                }
                if (vl.soLuong < item.soLuong) {
                    return res.status(400).json({
                        success: false,
                        message: `Vật liệu "${vl.tenVatLieu}" không đủ tồn kho (còn ${vl.soLuong} ${vl.donViTinh || ""})`,
                    });
                }
            }

            const bulkOps = list.map((item) => ({
                updateOne: {
                    filter: { _id: item.vatLieu },
                    update: { $inc: { soLuong: -item.soLuong } },
                },
            }));
            if (bulkOps.length > 0) await VatLieu.bulkWrite(bulkOps);
        }

        if (trangThai !== undefined) phieu.trangThai = trangThai;
        if (ghiChu !== undefined) phieu.ghiChu = ghiChu;
        if (danhSachVatLieu !== undefined) phieu.danhSachVatLieu = danhSachVatLieu;
        if (boPhan !== undefined) phieu.boPhan = boPhan;
        if (nhanVien !== undefined) phieu.nhanVien = nhanVien;

        const updated = await phieu.save();
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi cập nhật phiếu xuất kho",
            error: error.message,
        });
    }
};

// Chỉ xóa được phiếu "Chưa xuất"
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const phieu = await PhieuXuatKho.findById(id);
        if (!phieu) {
            return res.status(404).json({ success: false, message: "Phiếu xuất kho không tồn tại" });
        }
        if (phieu.trangThai === "Đã xuất") {
            return res.status(400).json({
                success: false,
                message: "Không thể xóa phiếu đã xuất hàng",
            });
        }

        await PhieuXuatKho.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Xóa phiếu xuất kho thành công" });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa phiếu xuất kho",
            error: error.message,
        });
    }
};
