const DonHang = require("../models/DonHang");
const BenhNhan = require("../models/BenhNhan");
const NguoiLienHe = require("../models/NguoiLienHe");
const NhaKhoa = require("../models/NhaKhoa");
const PhieuBaoHanh = require("../models/PhieuBaoHanh");
const SanPham = require("../models/SanPham");

const buildOrderCodePrefix = (date = new Date()) => {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `TAN${yy}${mm}`;
};

// Tự động xác định trạng thái dựa trên yêu cầu thử:
// - Có ít nhất 1 sản phẩm với yeuCauThu không rỗng → "Đang thử"
// - Không còn yeuCauThu và trước đó là "Đang thử" → "Chờ xử lý"
// - Trạng thái "Hoàn thành" / "Đã giao" không bị ghi đè
const resolveTrangThaiTuYeuCauThu = (danhSachSanPham, currentTrangThai) => {
    if (currentTrangThai === "Hoàn thành" || currentTrangThai === "Đã giao") {
        return currentTrangThai;
    }
    const hasYeuCauThu = (danhSachSanPham || []).some(
        (sp) => Array.isArray(sp.yeuCauThu) && sp.yeuCauThu.length > 0
    );
    if (hasYeuCauThu) return "Đang thử";
    // Không còn yêu cầu thử → về "Chờ xử lý"
    if (currentTrangThai === "Đang thử") return "Chờ xử lý";
    return currentTrangThai;
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

        // Kiểm tra logic Bệnh nhân
        const checkBenhNhan = await BenhNhan.findOne({ _id: benhNhan, nhaKhoa: nhaKhoa });

        if (!checkBenhNhan) {
            return res.status(400).json({ success: false, message: "Bệnh nhân không thuộc Nha khoa này" });
        }


        // Sinh mã theo chuẩn: TAN + YY + MM + 4 số tăng dần trong tháng
        let maDonHang = await generateMaDonHang();
        let retry = 0;

        while (retry < 3) {
            try {
                const autoTrangThai = resolveTrangThaiTuYeuCauThu(danhSachSanPham, req.body.trangThai || "Chờ xử lý");
                const newDonHang = new DonHang({
                    ...req.body,
                    danhSachSanPham, // Chỉ lưu thông tin sản xuất, chưa snapshot giá
                    maDonHang,
                    trangThai: autoTrangThai,
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
            DonHang.aggregate([{ $match: filter }, { $group: { _id: "$trangThai", count: { $sum: 1 } } }]),
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
            .populate("nhaKhoa", "hoVaTen tenGiaoDich soDienThoai email diaChiCuThe moTa")
            .populate("bacSi", "hoVaTen soDienThoai email")
            .populate("benhNhan", "hoVaTen soHoSo soDienThoai")
            .populate("danhSachSanPham.sanPham", "tenSanPham donGiaChung loaiTinh quyTrinh baoHanhMacDinh")
            .populate("danhSachSanPham.donHangCu")
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

// Định dạng viTri thành chuỗi dễ đọc
const formatViTri = (viTriArr) => {
    if (!viTriArr || viTriArr.length === 0) return " ";
    return viTriArr
        .map((v) =>
            v.kieu === "Rời"
                ? v.soRang.join(", ")
                : `${v.soRang[0]}->${v.soRang[v.soRang.length - 1]}`
        )
        .join("; ");
};

// Định dạng ngày giờ tiếng Việt
const formatDT = (d) => {
    if (!d) return " ";
    const dt = new Date(d);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

// Helper: so sánh old và updateData, trả về chuỗi mô tả chi tiết các thay đổi
const buildChinhSuaLog = async (old, updates) => {
    const changes = [];

    // --- Thu thập tất cả sanPham IDs để tra tên ---
    const spIds = new Set();
    (old.danhSachSanPham || []).forEach((s) => { if (s.sanPham) spIds.add(String(s.sanPham)); });
    (updates.danhSachSanPham || []).forEach((s) => { if (s.sanPham) spIds.add(String(s.sanPham)); });
    const spDocs = spIds.size > 0
        ? await SanPham.find({ _id: { $in: [...spIds] } }).select("tenSanPham").lean()
        : [];
    const spNameMap = {};
    spDocs.forEach((sp) => { spNameMap[String(sp._id)] = sp.tenSanPham; });

    // --- 1. Trạng thái ---
    if ("trangThai" in updates && String(old.trangThai || "") !== String(updates.trangThai || "")) {
        changes.push(`Trạng thái: "${old.trangThai}" → "${updates.trangThai}"`);
    }

    // --- 2. Các trường ngày giờ ---
    const dateFields = [
        ["ngayNhan", "Ngày nhận"],
        ["yeuCauHoanThanh", "Y/c hoàn thành"],
        ["henGiao", "Hẹn giao"],
    ];
    for (const [field, label] of dateFields) {
        if (!(field in updates)) continue;
        const oldStr = formatDT(old[field]);
        const newStr = formatDT(updates[field]);
        if (oldStr !== newStr) changes.push(`${label}: ${oldStr} → ${newStr}`);
    }

    // --- 3. Bác sĩ ---
    if ("bacSi" in updates) {
        const oldId = old.bacSi ? String(old.bacSi) : "";
        const newId = updates.bacSi ? String(updates.bacSi) : "";
        if (oldId !== newId) {
            const ids = [oldId, newId].filter(Boolean);
            const docs = ids.length > 0
                ? await NguoiLienHe.find({ _id: { $in: ids } }).select("hoVaTen").lean()
                : [];
            const nameMap = {};
            docs.forEach((d) => { nameMap[String(d._id)] = d.hoVaTen; });
            const oldName = (oldId && nameMap[oldId]) || " ";
            const newName = (newId && nameMap[newId]) || " ";
            changes.push(`Bác sĩ: "${oldName}" → "${newName}"`);
        }
    }

    // --- 4. Chỉ định bác sĩ ---
    if ("chiDinhBacSi" in updates) {
        const oldVal = (old.chiDinhBacSi || "").trim();
        const newVal = (updates.chiDinhBacSi || "").trim();
        if (oldVal !== newVal) {
            changes.push(`Chỉ định bác sĩ: "${oldVal || " "}" → "${newVal || " "}"`);
        }
    }

    // --- 5. Ghi chú ---
    const ghiChuFields = [
        ["ghiChuChung", "Ghi chú chung"],
        ["ghiChuTaiChinh", "Ghi chú tài chính"],
        ["ghiChuSanXuat", "Ghi chú sản xuất"],
    ];
    for (const [field, label] of ghiChuFields) {
        if (!(field in updates)) continue;
        const oldVal = (old[field] || "").trim();
        const newVal = (updates[field] || "").trim();
        if (oldVal !== newVal) {
            changes.push(`${label}: "${oldVal || " "}" → "${newVal || " "}"`);
        }
    }

    // --- 6. Danh sách sản phẩm (so sánh từng dòng) ---
    if ("danhSachSanPham" in updates) {
        const oldList = old.danhSachSanPham || [];
        const newList = updates.danhSachSanPham || [];
        const maxLen = Math.max(oldList.length, newList.length);

        for (let i = 0; i < maxLen; i++) {
            const oldSp = oldList[i];
            const newSp = newList[i];
            const resolvedName =
                spNameMap[String(newSp?.sanPham || "")] ||
                spNameMap[String(oldSp?.sanPham || "")] ||
                `dòng ${i + 1}`;

            if (!oldSp) {
                changes.push(`Thêm sản phẩm "${resolvedName}"`);
                continue;
            }
            if (!newSp) {
                const oldName = spNameMap[String(oldSp.sanPham)] || `dòng ${i + 1}`;
                changes.push(`Xóa sản phẩm "${oldName}"`);
                continue;
            }

            // Tên sản phẩm thay đổi (replace cả dòng)
            if (String(oldSp.sanPham) !== String(newSp.sanPham)) {
                const oldName = spNameMap[String(oldSp.sanPham)] || "(không rõ)";
                const newName = spNameMap[String(newSp.sanPham)] || "(không rõ)";
                changes.push(`Dòng ${i + 1}: thay sản phẩm "${oldName}" → "${newName}"`);
                continue; // Không cần so sánh chi tiết hơn nếu sp khác hẳn
            }

            const spLabel = `Sản phẩm "${resolvedName}"`;

            // Số lượng
            if (Number(oldSp.soLuong) !== Number(newSp.soLuong)) {
                changes.push(`${spLabel} - Số lượng: ${oldSp.soLuong} → ${newSp.soLuong}`);
            }
            // Màu
            if ((oldSp.mau || "") !== (newSp.mau || "")) {
                changes.push(`${spLabel} - Màu: "${oldSp.mau || " "}" → "${newSp.mau || " "}"`);
            }
            // Vị trí răng
            const oldViTri = formatViTri(oldSp.viTri);
            const newViTri = formatViTri(newSp.viTri);
            if (oldViTri !== newViTri) {
                changes.push(`${spLabel} - Vị trí răng: ${oldViTri} → ${newViTri}`);
            }
            // Loại đơn
            if ((oldSp.loaiDon || "") !== (newSp.loaiDon || "")) {
                changes.push(`${spLabel} - Loại đơn: "${oldSp.loaiDon}" → "${newSp.loaiDon}"`);
            }
            // Ghi chú sản phẩm
            if ((oldSp.ghiChu || "").trim() !== (newSp.ghiChu || "").trim()) {
                changes.push(`${spLabel} - Ghi chú: "${oldSp.ghiChu || "(trống)"}" → "${newSp.ghiChu || "(trống)"}"`);
            }
            // Yêu cầu thử
            const oldYCT = (oldSp.yeuCauThu || []).map((y) => y.congDoan).filter(Boolean).sort();
            const newYCT = (newSp.yeuCauThu || []).map((y) => y.congDoan).filter(Boolean).sort();
            const addedYCT = newYCT.filter((y) => !oldYCT.includes(y));
            const removedYCT = oldYCT.filter((y) => !newYCT.includes(y));
            if (addedYCT.length > 0) {
                changes.push(`${spLabel} - Yêu cầu thử: thêm "${addedYCT.join('", "')}"`);
            }
            if (removedYCT.length > 0) {
                changes.push(`${spLabel} - Yêu cầu thử: bỏ "${removedYCT.join('", "')}"`);
            }
        }
    }

    // --- 7. Danh sách phụ kiện ---
    if ("danhSachPhuKien" in updates) {
        const oldPK = old.danhSachPhuKien || [];
        const newPK = updates.danhSachPhuKien || [];
        const oldMap = {};
        oldPK.forEach((p) => { oldMap[p.tenPhuKien] = p; });
        const newMap = {};
        newPK.forEach((p) => { newMap[p.tenPhuKien] = p; });

        for (const key of Object.keys(newMap)) {
            if (!oldMap[key]) {
                changes.push(`Thêm phụ kiện "${key}" (SL: ${newMap[key].soLuong}, ${newMap[key].soHuu})`);
            }
        }
        for (const key of Object.keys(oldMap)) {
            if (!newMap[key]) {
                changes.push(`Xóa phụ kiện "${key}"`);
            }
        }
        for (const key of Object.keys(newMap)) {
            if (oldMap[key]) {
                const o = oldMap[key];
                const n = newMap[key];
                if (Number(o.soLuong) !== Number(n.soLuong)) {
                    changes.push(`Phụ kiện "${key}" - Số lượng: ${o.soLuong} → ${n.soLuong}`);
                }
                if ((o.soHuu || "") !== (n.soHuu || "")) {
                    changes.push(`Phụ kiện "${key}" - Sở hữu: "${o.soHuu}" → "${n.soHuu}"`);
                }
            }
        }
    }

    return changes.length > 0 ? changes.join("; ") : "Chỉnh sửa đơn hàng (không có thay đổi)";
};

// [PUT] Cập nhật đơn hàng
exports.updateDonHang = async (req, res) => {
    try {
        const { nhatKyLogEntry, nhatKyChinhSua: _nhatKy, nguoiThucDuyet: _nguoi, ...updateData } = req.body;

        // Lấy đơn hàng hiện tại để kiểm tra trạng thái khoá và so sánh thay đổi
        const donHangHienTai = await DonHang.findById(req.params.id)
            .select("trangThai daXuatHoaDon ngayNhan yeuCauHoanThanh henGiao bacSi chiDinhBacSi ghiChuChung ghiChuTaiChinh ghiChuSanXuat danhSachSanPham danhSachPhuKien")
            .lean();
        if (!donHangHienTai) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        }
        if (donHangHienTai.trangThai === "Đã giao" || donHangHienTai.daXuatHoaDon) {
            return res.status(400).json({
                success: false,
                message: "Không thể chỉnh sửa đơn hàng đã xuất hóa đơn hoặc đã giao",
            });
        }

        // 🔥 Bảo vệ ngày nhận nếu đã xuất HĐ (redundant nhưng giữ lại an toàn)
        if (updateData.ngayNhan) {
            const oldDate = new Date(donHangHienTai.ngayNhan).getTime();
            const newDate = new Date(updateData.ngayNhan).getTime();
            if (oldDate !== newDate && donHangHienTai.daXuatHoaDon) {
                return res.status(400).json({
                    success: false,
                    message: "Đơn hàng này đã được xuất hóa đơn, hệ thống đã đóng băng không cho phép sửa ngày nhận!"
                });
            }
        }

        // Xây dựng mô tả chi tiết những gì đã thay đổi
        const chiTietThayDoi = await buildChinhSuaLog(donHangHienTai, updateData);

        // Nếu cập nhật danh sách sản phẩm → tự động xác định trạng thái "Đang thử"
        if ("danhSachSanPham" in updateData) {
            const baseTrangThai = updateData.trangThai || donHangHienTai.trangThai;
            updateData.trangThai = resolveTrangThaiTuYeuCauThu(updateData.danhSachSanPham, baseTrangThai);
        }

        const updateOp = { $set: updateData };
        if (nhatKyLogEntry) {
            updateOp.$push = {
                nhatKyChinhSua: {
                    nguoiThuc: nhatKyLogEntry.nguoiThuc || "Điều Phối",
                    hanhDong: chiTietThayDoi,
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
        const donHang = await DonHang.findById(req.params.id).select("trangThai daXuatHoaDon");
        if (!donHang) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        }
        if (donHang.trangThai === "Đã giao" || donHang.daXuatHoaDon) {
            return res.status(400).json({
                success: false,
                message: "Không thể xóa đơn hàng đã xuất hóa đơn hoặc đã giao",
            });
        }
        await DonHang.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Xóa đơn hàng thành công" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// [GET] Thống kê tổng quan
exports.getThongKe = async (req, res) => {
    try {
        const now = new Date();

        // Đầu ngày hôm nay (00:00:00) và cuối ngày (23:59:59) theo UTC+7
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);

        const [giaoHomNay, treHenGiao, guiThu] = await Promise.all([
            // 1. Đơn có henGiao rơi vào hôm nay (bất kể trạng thái)
            DonHang.countDocuments({
                henGiao: { $gte: startOfToday, $lte: endOfToday },
            }),

            // 2. Đơn trễ hẹn giao: henGiao đã qua nhưng chưa hoàn thành / chưa giao
            DonHang.countDocuments({
                henGiao: { $lt: startOfToday },
                trangThai: { $nin: ["Hoàn thành", "Đã giao"] },
            }),

            // 3. Đơn đang ở trạng thái "Đang thử"
            DonHang.countDocuments({
                trangThai: "Đang thử",
            }),
        ]);

        res.status(200).json({
            success: true,
            data: {
                giaoHomNay,   // Số đơn hẹn giao hôm nay
                treHenGiao,   // Số đơn trễ hẹn giao (chưa hoàn thành)
                guiThu,       // Số đơn đang có yêu cầu thử (chưa hoàn thành)
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy thống kê",
            error: error.message,
        });
    }
};
