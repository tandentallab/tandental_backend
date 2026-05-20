const DonHang = require("../models/DonHang");
const BenhNhan = require("../models/BenhNhan");
const NguoiLienHe = require("../models/NguoiLienHe");
const NhaKhoa = require("../models/NhaKhoa");
const PhieuBaoHanh = require("../models/PhieuBaoHanh");

const buildOrderCodePrefix = (date = new Date()) => {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `TAN${yy}${mm}`;
};

const generateMaDonHang = async () => {
    const prefix = buildOrderCodePrefix();
    const regex = new RegExp(`^${prefix}\\d{4}$`);

    const latest = await DonHang.findOne({ maDonHang: { $regex: regex } })
        .sort({ maDonHang: -1 })
        .select("maDonHang")
        .lean();

    let nextSequence = 0;
    if (latest?.maDonHang) {
        const lastSeq = Number(latest.maDonHang.slice(-4));
        if (Number.isFinite(lastSeq)) {
            nextSequence = lastSeq + 1;
        }
    }

    return `${prefix}${String(nextSequence).padStart(4, "0")}`;
};

// [POST] Tạo đơn hàng mới
exports.createDonHang = async (req, res) => {
    try {
        const { nhaKhoa, bacSi, benhNhan, danhSachSanPham } = req.body;

        // Kiểm tra logic Bác sĩ và Bệnh nhân
        const checkBenhNhan = await BenhNhan.findOne({ _id: benhNhan, nhaKhoa: nhaKhoa });
        const checkBacSi = await NguoiLienHe.findOne({ _id: bacSi, nhaKhoa: nhaKhoa });

        if (!checkBenhNhan) {
            return res.status(400).json({ success: false, message: "Bệnh nhân không thuộc Nha khoa này" });
        }
        if (!checkBacSi) {
            return res.status(400).json({ success: false, message: "Bác sĩ không thuộc Nha khoa này" });
        }

        const BangGia = require("../models/BangGia");
        const SanPham = require("../models/SanPham");

        if (danhSachSanPham && Array.isArray(danhSachSanPham)) {
            for (let spItem of danhSachSanPham) {
                // SỬA Ở ĐÂY: Dùng đúng 'nhaKhoaId' và 'sanPhamId' theo cấu trúc của BangGia.js
                const giaRieng = await BangGia.findOne({
                    nhaKhoaId: nhaKhoa,
                    sanPhamId: spItem.sanPham
                });

                if (giaRieng) {
                    // Nếu có giá riêng, lấy giá riêng
                    spItem.donGia = giaRieng.donGia || giaRieng.gia || 0;
                } else {
                    // Nếu không có giá riêng, lấy giá chung
                    const spGoc = await SanPham.findById(spItem.sanPham);
                    spItem.donGia = spGoc?.donGiaChung || 0;
                }
            }
        }

        // Sinh mã theo chuẩn: TAN + YY + MM + 4 số tăng dần trong tháng
        let maDonHang = await generateMaDonHang();
        let retry = 0;

        while (retry < 3) {
            try {
                const newDonHang = new DonHang({
                    ...req.body,
                    danhSachSanPham, // Nạp danh sách sản phẩm đã được gán đơn giá cứng
                    maDonHang,
                    nhatKyChinhSua: [{
                        nguoiThuc: req.body.nguoiThucDuyet || "Điều Phối",
                        hanhDong: "Tạo đơn hàng",
                        thoiGian: new Date(),
                    }],
                });
                await newDonHang.save();

                return res.status(201).json({
                    success: true,
                    message: "Tạo đơn hàng thành công",
                    data: newDonHang,
                });
            } catch (saveError) {
                if (saveError?.code !== 11000 || !saveError?.keyPattern?.maDonHang) {
                    throw saveError;
                }
                retry += 1;
                maDonHang = await generateMaDonHang();
            }
        }

        return res.status(500).json({
            success: false,
            message: "Không thể sinh mã đơn hàng duy nhất. Vui lòng thử lại.",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi tạo đơn hàng",
            error: error.message,
        });
    }
};

// [GET] Lấy danh sách đơn hàng (có phân trang, tìm kiếm, lọc)
exports.getAllDonHang = async (req, res) => {
    try {
        const {
            page = 1, limit = 20,
            search = "",
            nhaKhoa, benhNhan, trangThai,
            ngayNhanFrom, ngayNhanTo,
            ycHoanThanhFrom, ycHoanThanhTo,
            henGiaoFrom, henGiaoTo,
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.max(1, Math.min(5000, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const filter = {};
        if (nhaKhoa) filter.nhaKhoa = nhaKhoa;
        if (benhNhan) filter.benhNhan = benhNhan;
        if (trangThai) filter.trangThai = { $in: trangThai.split(",") };

        if (ngayNhanFrom || ngayNhanTo) {
            filter.ngayNhan = {};
            if (ngayNhanFrom) filter.ngayNhan.$gte = new Date(ngayNhanFrom);
            if (ngayNhanTo) filter.ngayNhan.$lte = new Date(ngayNhanTo);
        }
        if (ycHoanThanhFrom || ycHoanThanhTo) {
            filter.yeuCauHoanThanh = {};
            if (ycHoanThanhFrom) filter.yeuCauHoanThanh.$gte = new Date(ycHoanThanhFrom);
            if (ycHoanThanhTo) filter.yeuCauHoanThanh.$lte = new Date(ycHoanThanhTo);
        }
        if (henGiaoFrom || henGiaoTo) {
            filter.henGiao = {};
            if (henGiaoFrom) filter.henGiao.$gte = new Date(henGiaoFrom);
            if (henGiaoTo) filter.henGiao.$lte = new Date(henGiaoTo);
        }

        // Text search: query related collections for matching IDs
        if (search && search.trim()) {
            const keyword = search.trim();
            const regex = { $regex: keyword, $options: "i" };
            const [nkIds, bnIds, bsIds] = await Promise.all([
                NhaKhoa.find({ $or: [{ tenGiaoDich: regex }, { hoVaTen: regex }] }).distinct("_id"),
                BenhNhan.find({ hoVaTen: regex }).distinct("_id"),
                NguoiLienHe.find({ hoVaTen: regex }).distinct("_id"),
            ]);
            const orConditions = [{ maDonHang: regex }];
            if (nkIds.length > 0) orConditions.push({ nhaKhoa: { $in: nkIds } });
            if (bnIds.length > 0) orConditions.push({ benhNhan: { $in: bnIds } });
            if (bsIds.length > 0) orConditions.push({ bacSi: { $in: bsIds } });
            filter.$or = orConditions;
        }

        const populateOpts = [
            { path: "nhaKhoa", select: "tenGiaoDich hoVaTen" },
            { path: "bacSi", select: "hoVaTen soDienThoai" },
            { path: "benhNhan", select: "hoVaTen soHoSo" },
            { path: "danhSachSanPham.sanPham", select: "tenSanPham donGiaChung loaiTinh quyTrinh" },
        ];

        const now = new Date();
        const [donHangs, total, statsRaw, treHen] = await Promise.all([
            DonHang.find(filter)
                .populate(populateOpts)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            DonHang.countDocuments(filter),
            DonHang.aggregate([{ $group: { _id: "$trangThai", count: { $sum: 1 } } }]),
            DonHang.countDocuments({ henGiao: { $lt: now }, trangThai: { $nin: ["Hoàn thành", "Đã giao"] } }),
        ]);

        const stats = { treHen };
        statsRaw.forEach((s) => { if (s._id) stats[s._id] = s.count; });

        res.status(200).json({
            success: true,
            data: donHangs,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
            currentPage: pageNum,
            stats,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách đơn hàng",
            error: error.message,
        });
    }
};

// [GET] Lấy chi tiết 1 đơn hàng
exports.getDonHangById = async (req, res) => {
    try {
        const donHang = await DonHang.findById(req.params.id)
            .populate("nhaKhoa", "hoVaTen tenGiaoDich soDienThoai email diaChiCuThe")
            .populate("bacSi", "hoVaTen soDienThoai email")
            .populate("benhNhan", "hoVaTen soHoSo soDienThoai")
            .populate("danhSachSanPham.sanPham", "tenSanPham donGiaChung loaiTinh quyTrinh baoHanhMacDinh")
            .populate("danhSachSanPham.donHangCu");

        if (!donHang) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        }

        // Query phiếu bảo hành từ collection (không dùng reference)
        const phieuBaoHanh = await PhieuBaoHanh.findOne({ donHang: req.params.id })
            .populate("danhSachBaoHanh.sanPham", "tenSanPham");

        // Convert Mongoose doc sang object và thêm phiếu bảo hành
        const donHangObj = donHang.toObject ? donHang.toObject() : donHang;
        donHangObj.phieuBaoHanh = phieuBaoHanh || null;

        res.status(200).json({ success: true, data: donHangObj });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// [PUT] Cập nhật đơn hàng
exports.updateDonHang = async (req, res) => {
    try {
        const { nhatKyLogEntry, nhatKyChinhSua: _nhatKy, nguoiThucDuyet: _nguoi, ...updateData } = req.body;

        const updateOp = { $set: updateData };
        if (nhatKyLogEntry) {
            updateOp.$push = {
                nhatKyChinhSua: {
                    nguoiThuc: nhatKyLogEntry.nguoiThuc || "Điều Phối",
                    hanhDong: nhatKyLogEntry.hanhDong || "Chỉnh sửa",
                    thoiGian: new Date(),
                },
            };
        }

        const updatedDonHang = await DonHang.findByIdAndUpdate(req.params.id, updateOp, { new: true })
            .populate("nhaKhoa", "hoVaTen tenGiaoDich soDienThoai email diaChiCuThe")
            .populate("bacSi", "hoVaTen soDienThoai email")
            .populate("benhNhan", "hoVaTen soHoSo soDienThoai")
            .populate("danhSachSanPham.sanPham", "tenSanPham donGiaChung loaiTinh quyTrinh baoHanhMacDinh")
            .populate("danhSachSanPham.donHangCu");

        if (!updatedDonHang) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        }

        // Query phiếu bảo hành từ collection
        const phieuBaoHanh = await PhieuBaoHanh.findOne({ donHang: req.params.id })
            .populate("danhSachBaoHanh.sanPham", "tenSanPham");

        // Convert Mongoose doc sang object và thêm phiếu bảo hành
        const updatedDonHangObj = updatedDonHang.toObject ? updatedDonHang.toObject() : updatedDonHang;
        updatedDonHangObj.phieuBaoHanh = phieuBaoHanh || null;

        res.status(200).json({ success: true, data: updatedDonHangObj });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// [PATCH] Cập nhật trạng thái công đoạn
exports.updateCongDoanStatus = async (req, res) => {
    try {
        const { spIndex, thuTu, trangThai } = req.body;
        const donHang = await DonHang.findById(req.params.id);
        if (!donHang) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        }
        if (spIndex === undefined || spIndex < 0 || spIndex >= donHang.danhSachSanPham.length) {
            return res.status(400).json({ success: false, message: "spIndex không hợp lệ" });
        }
        const sp = donHang.danhSachSanPham[spIndex];
        const existing = sp.trangThaiCongDoan.find((cd) => cd.thuTu === thuTu);
        if (existing) {
            existing.trangThai = trangThai;
        } else {
            sp.trangThaiCongDoan.push({ thuTu, trangThai });
        }
        await donHang.save();
        await donHang.populate("danhSachSanPham.sanPham", "tenSanPham donGiaChung loaiTinh quyTrinh baoHanhMacDinh");
        res.status(200).json({ success: true, data: donHang });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// [DELETE] Xóa đơn hàng
exports.deleteDonHang = async (req, res) => {
    try {
        const deletedDonHang = await DonHang.findByIdAndDelete(req.params.id);
        if (!deletedDonHang) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        }
        res.status(200).json({ success: true, message: "Xóa đơn hàng thành công" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};