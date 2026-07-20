const PhieuNhapKho = require("../models/PhieuNhapKho");
const VatLieu = require("../models/VatLieu");
const NhaCungCap = require("../models/NhaCungCap");

exports.getAll = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};

        if (req.query.soPhieu) {
            filter.soPhieu = { $regex: req.query.soPhieu, $options: "i" };
        }

        // backward-compat: trangThai cũ → trangThaiNhap / trangThaiThanhToan
        if (req.query.trangThai) {
            const values = req.query.trangThai.split(",").filter(Boolean);
            const nhapVals = values.filter((v) => ["Chưa nhận", "Đã nhận"].includes(v));
            const toanVals = values.filter((v) =>
                ["Chưa thanh toán", "Đã thanh toán"].includes(v)
            );
            const vatVals = values.filter((v) => ["Có VAT", "Không VAT"].includes(v));

            if (nhapVals.length)
                filter.trangThaiNhap = nhapVals.length === 1 ? nhapVals[0] : { $in: nhapVals };
            if (toanVals.length)
                filter.trangThaiThanhToan =
                    toanVals.length === 1 ? toanVals[0] : { $in: toanVals };
            if (vatVals.length === 1) {
                filter.VAT = vatVals[0] === "Có VAT";
            }
            // nếu chọn cả 2 (Có VAT + Không VAT) thì coi như không lọc, giống cách nhapVals/toanVals xử lý khi chọn hết
        }

        // hỗ trợ gọi trực tiếp qua query riêng, ví dụ ?VAT=true
        if (req.query.VAT !== undefined && filter.VAT === undefined) {
            filter.VAT = req.query.VAT === "true";
        }

        if (req.query.trangThaiNhap) {
            const values = req.query.trangThaiNhap.split(",").filter(Boolean);
            filter.trangThaiNhap = values.length === 1 ? values[0] : { $in: values };
        }
        if (req.query.trangThaiThanhToan) {
            const values = req.query.trangThaiThanhToan.split(",").filter(Boolean);
            filter.trangThaiThanhToan = values.length === 1 ? values[0] : { $in: values };
        }

        if (req.query.nguoiTao) {
            filter.nguoiTao = { $regex: req.query.nguoiTao, $options: "i" };
        }

        // NCC nay là top-level field (chọn từ select, khớp chính xác)
        if (req.query.nhaCungCap) {
            const ncc = await NhaCungCap.findOne({ ten: req.query.nhaCungCap }).select("_id");
            if (ncc) {
                filter.nhaCungCap = ncc._id;
            } else {
                return res.status(200).json({ success: true, data: [], total: 0, page, limit });
            }
        }

        // Lọc theo tên vật liệu — tìm các VatLieu khớp tên rồi lọc phiếu chứa vật liệu đó
        if (req.query.tenVatLieu) {
            const vlMatches = await VatLieu.find({
                tenVatLieu: { $regex: req.query.tenVatLieu, $options: "i" },
            }).select("_id");

            if (vlMatches.length) {
                filter["danhSachVatLieu.vatLieu"] = { $in: vlMatches.map((v) => v._id) };
            } else {
                return res.status(200).json({ success: true, data: [], total: 0, page, limit });
            }
        }

        // Search chung: số phiếu HOẶC tên nhà cung cấp
        if (req.query.timKiem) {
            const kw = req.query.timKiem;
            const nccMatches = await NhaCungCap.find({
                ten: { $regex: kw, $options: "i" },
            }).select("_id");

            filter.$or = [
                { soPhieu: { $regex: kw, $options: "i" } },
                ...(nccMatches.length ? [{ nhaCungCap: { $in: nccMatches.map((n) => n._id) } }] : []),
            ];
        }

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
            .select(
                "ngayTao soPhieu trangThaiNhap trangThaiThanhToan nguoiTao ghiChu nhaCungCap danhSachVatLieu ngayNhan VAT"
            )
            .populate("nhaCungCap", "ten")
            .populate("danhSachVatLieu.vatLieu", "tenVatLieu donViTinh")
            .sort({ ngayTao: -1 })
            .skip(skip)
            .limit(limit);

        const data = phieuNhapKhos.map((phieu) => {
            const tongTien = phieu.danhSachVatLieu.reduce(
                (sum, item) => sum + (item.thanhTien || 0),
                0
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
            .populate("nhaCungCap", "ten diaChi soDienThoai")
            .populate("danhSachVatLieu.vatLieu", "tenVatLieu maVatLieu donViTinh giaMua");

        if (!phieuNhapKho) {
            return res
                .status(404)
                .json({ success: false, message: "Phiếu nhập kho không tồn tại" });
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
        const { nhaCungCap, danhSachVatLieu, ghiChu, nguoiTao } = req.body;

        const newPhieu = new PhieuNhapKho({
            nhaCungCap: nhaCungCap || null,
            danhSachVatLieu,
            ghiChu,
            nguoiTao,
        });
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

// Cập nhật nội dung (chỉ khi "Chưa nhận") hoặc đổi trạng thái
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { trangThaiNhap, trangThaiThanhToan, nhaCungCap, ghiChu, danhSachVatLieu, currentRole, VAT } =
            req.body;

        const phieu = await PhieuNhapKho.findById(id);
        if (!phieu) {
            return res
                .status(404)
                .json({ success: false, message: "Phiếu nhập kho không tồn tại" });
        }

        if (
            phieu.trangThaiNhap === "Đã nhận" &&
            (danhSachVatLieu !== undefined || nhaCungCap !== undefined)
        ) {
            if (currentRole !== "Admin") {
                return res.status(400).json({
                    success: false,
                    message: "Không thể chỉnh sửa phiếu đã nhận hàng",
                });
            }
        }

        if (trangThaiNhap === "Đã nhận" && phieu.trangThaiNhap === "Chưa nhận") {
            const list = danhSachVatLieu || phieu.danhSachVatLieu;
            const bulkOps = list.map((item) => ({
                updateOne: {
                    filter: { _id: item.vatLieu },
                    update: { $inc: { soLuong: item.soLuong } },
                },
            }));
            if (bulkOps.length > 0) await VatLieu.bulkWrite(bulkOps);
            phieu.ngayNhan = new Date();
        }

        if (trangThaiNhap !== undefined) phieu.trangThaiNhap = trangThaiNhap;
        if (trangThaiThanhToan !== undefined) phieu.trangThaiThanhToan = trangThaiThanhToan;
        if (ghiChu !== undefined) phieu.ghiChu = ghiChu;
        if (danhSachVatLieu !== undefined) phieu.danhSachVatLieu = danhSachVatLieu;
        if (nhaCungCap !== undefined) phieu.nhaCungCap = nhaCungCap || null;
        if (VAT !== undefined) phieu.VAT = VAT;

        await phieu.save();

        // Populate lại + tính tongTien giống getAll, để FE merge không bị mất dữ liệu
        const populated = await PhieuNhapKho.findById(phieu._id)
            .populate("nhaCungCap", "ten")
            .populate("danhSachVatLieu.vatLieu", "tenVatLieu donViTinh");

        const tongTien = populated.danhSachVatLieu.reduce(
            (sum, item) => sum + (item.thanhTien || 0),
            0
        );

        res.status(200).json({ success: true, data: { ...populated.toObject(), tongTien } });
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
            return res
                .status(404)
                .json({ success: false, message: "Phiếu nhập kho không tồn tại" });
        }
        if (phieu.trangThaiNhap === "Đã nhận") {
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