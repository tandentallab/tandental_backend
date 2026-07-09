const PhieuMuonVatLieu = require("../models/PhieuMuonVatLieu");
const VatLieu = require("../models/VatLieu");

exports.getAll = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};

        if (req.query.loai) {
            const values = req.query.loai.split(",").filter(Boolean);
            filter.loai = values.length === 1 ? values[0] : { $in: values };
        }

        if (req.query.trangThaiNhan) {
            const values = req.query.trangThaiNhan.split(",").filter(Boolean);
            filter.trangThaiNhan = values.length === 1 ? values[0] : { $in: values };
        }

        if (req.query.trangThaiTra) {
            const values = req.query.trangThaiTra.split(",").filter(Boolean);
            filter.trangThaiTra = values.length === 1 ? values[0] : { $in: values };
        }

        if (req.query.nhanVien) filter.nhanVien = { $regex: req.query.nhanVien, $options: "i" };

        if (req.query.doiTac) filter["doiTac.ten"] = { $regex: req.query.doiTac, $options: "i" };

        if (req.query.tuNgay || req.query.denNgay) {
            filter.ngayTao = {};
            if (req.query.tuNgay) filter.ngayTao.$gte = new Date(req.query.tuNgay);
            if (req.query.denNgay) {
                const den = new Date(req.query.denNgay);
                den.setHours(23, 59, 59, 999);
                filter.ngayTao.$lte = den;
            }
        }

        const total = await PhieuMuonVatLieu.countDocuments(filter);

        const phieuMuons = await PhieuMuonVatLieu.find(filter)
            .select(
                "ngayTao loai nhanVien doiTac trangThaiNhan trangThaiTra ghiChu danhSachVatLieu"
            )
            .populate("danhSachVatLieu.vatLieu", "tenVatLieu donViTinh")
            .sort({ ngayTao: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({ success: true, data: phieuMuons, total, page, limit });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách phiếu mượn",
            error: error.message,
        });
    }
};

exports.getById = async (req, res) => {
    try {
        const phieuMuon = await PhieuMuonVatLieu.findById(req.params.id).populate(
            "danhSachVatLieu.vatLieu",
            "tenVatLieu maVatLieu donViTinh soLuong"
        );

        if (!phieuMuon) {
            return res.status(404).json({ success: false, message: "Phiếu mượn không tồn tại" });
        }

        res.status(200).json({ success: true, data: phieuMuon });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy phiếu mượn",
            error: error.message,
        });
    }
};

exports.create = async (req, res) => {
    try {
        const { loai, nhanVien, doiTac, danhSachVatLieu, ghiChu } = req.body;

        const newPhieu = new PhieuMuonVatLieu({
            loai: loai || "Mượn",
            nhanVien,
            doiTac,
            danhSachVatLieu,
            ghiChu,
        });
        const saved = await newPhieu.save();
        await saved.populate("danhSachVatLieu.vatLieu", "tenVatLieu maVatLieu donViTinh soLuong");

        res.status(201).json({ success: true, data: saved });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi tạo phiếu mượn",
            error: error.message,
        });
    }
};

// Cập nhật nội dung (chỉ khi chưa xử lý bước nào) hoặc đổi trạng thái nhận/trả
// Logic tồn kho phụ thuộc "loai":
//  - "Mượn"      (mượn của đối tác): Đã nhận -> CỘNG kho | Đã trả -> TRỪ kho (kiểm tra đủ tồn)
//  - "Cho mượn"  (cho đối tác mượn): Đã nhận -> TRỪ kho (kiểm tra đủ tồn) | Đã trả -> CỘNG kho
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            trangThaiNhan,
            trangThaiTra,
            loai,
            nhanVien,
            doiTac,
            ghiChu,
            danhSachVatLieu,
            currentRole,
        } = req.body;

        const phieu = await PhieuMuonVatLieu.findById(id);
        if (!phieu) {
            return res.status(404).json({ success: false, message: "Phiếu mượn không tồn tại" });
        }

        const daXuLy = phieu.trangThaiNhan === "Đã nhận" || phieu.trangThaiTra === "Đã trả";

        // Không cho sửa nội dung / loại phiếu sau khi đã xử lý (trừ Admin)
        if (
            daXuLy &&
            (danhSachVatLieu !== undefined || loai !== undefined || doiTac !== undefined)
        ) {
            if (currentRole !== "Admin") {
                return res.status(400).json({
                    success: false,
                    message: "Không thể chỉnh sửa phiếu đã xử lý (đã nhận hoặc đã trả)",
                });
            }
        }

        const loaiPhieu = loai || phieu.loai;
        // trạng thái nhận sau khi áp dụng update này (để kiểm tra thứ tự nhận trước - trả sau)
        const trangThaiNhanMoi = trangThaiNhan !== undefined ? trangThaiNhan : phieu.trangThaiNhan;

        // Chuyển "Chưa nhận" -> "Đã nhận"
        if (trangThaiNhan === "Đã nhận" && phieu.trangThaiNhan === "Chưa nhận") {
            const list = danhSachVatLieu || phieu.danhSachVatLieu;

            if (loaiPhieu === "Mượn") {
                // Ta nhận vật liệu từ đối tác về kho -> cộng tồn
                const bulkOps = list.map((item) => ({
                    updateOne: {
                        filter: { _id: item.vatLieu },
                        update: { $inc: { soLuong: item.soLuong } },
                    },
                }));
                if (bulkOps.length > 0) await VatLieu.bulkWrite(bulkOps);
            } else {
                // "Cho mượn": đối tác nhận vật liệu từ ta -> kiểm tra đủ tồn rồi trừ
                for (const item of list) {
                    const vl = await VatLieu.findById(item.vatLieu);
                    if (!vl) {
                        return res
                            .status(400)
                            .json({ success: false, message: "Vật liệu không tồn tại" });
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
        }

        // Chuyển "Chưa trả" -> "Đã trả"
        if (trangThaiTra === "Đã trả" && phieu.trangThaiTra === "Chưa trả") {
            // Phải đã ở trạng thái "Đã nhận" (hoặc đang được chuyển sang trong cùng lần cập nhật này)
            if (trangThaiNhanMoi !== "Đã nhận") {
                return res.status(400).json({
                    success: false,
                    message: "Chỉ có thể trả khi phiếu đã ở trạng thái Đã nhận",
                });
            }

            const list = danhSachVatLieu || phieu.danhSachVatLieu;

            if (loaiPhieu === "Mượn") {
                // Ta trả lại vật liệu cho đối tác -> kiểm tra đủ tồn rồi trừ
                for (const item of list) {
                    const vl = await VatLieu.findById(item.vatLieu);
                    if (!vl) {
                        return res
                            .status(400)
                            .json({ success: false, message: "Vật liệu không tồn tại" });
                    }
                    if (vl.soLuong < item.soLuong) {
                        return res.status(400).json({
                            success: false,
                            message: `Vật liệu "${vl.tenVatLieu}" không đủ tồn kho để trả (còn ${vl.soLuong} ${vl.donViTinh || ""})`,
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
            } else {
                // "Cho mượn": đối tác trả lại vật liệu cho ta -> cộng tồn
                const bulkOps = list.map((item) => ({
                    updateOne: {
                        filter: { _id: item.vatLieu },
                        update: { $inc: { soLuong: item.soLuong } },
                    },
                }));
                if (bulkOps.length > 0) await VatLieu.bulkWrite(bulkOps);
            }
        }

        if (loai !== undefined) phieu.loai = loai;
        if (trangThaiNhan !== undefined) phieu.trangThaiNhan = trangThaiNhan;
        if (trangThaiTra !== undefined) phieu.trangThaiTra = trangThaiTra;
        if (nhanVien !== undefined) phieu.nhanVien = nhanVien;
        if (doiTac !== undefined) phieu.doiTac = doiTac;
        if (ghiChu !== undefined) phieu.ghiChu = ghiChu;
        if (danhSachVatLieu !== undefined) phieu.danhSachVatLieu = danhSachVatLieu;
        phieu.ngayCapNhat = new Date();

        const updated = await phieu.save();
        await updated.populate("danhSachVatLieu.vatLieu", "tenVatLieu maVatLieu donViTinh soLuong");

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi cập nhật phiếu mượn",
            error: error.message,
        });
    }
};

// Chỉ xóa được phiếu chưa xử lý bước nào ("Chưa nhận" và "Chưa trả")
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const phieu = await PhieuMuonVatLieu.findById(id);
        if (!phieu) {
            return res.status(404).json({ success: false, message: "Phiếu mượn không tồn tại" });
        }
        if (phieu.trangThaiNhan === "Đã nhận" || phieu.trangThaiTra === "Đã trả") {
            return res.status(400).json({
                success: false,
                message: "Không thể xóa phiếu đã nhận hoặc đã trả",
            });
        }

        await PhieuMuonVatLieu.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Xóa phiếu mượn thành công" });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa phiếu mượn",
            error: error.message,
        });
    }
};