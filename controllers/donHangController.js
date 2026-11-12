const DonHang = require("../models/DonHang");
const BenhNhan = require("../models/BenhNhan");
const NguoiLienHe = require("../models/NguoiLienHe");
const NhaKhoa = require("../models/NhaKhoa");
const PhieuBaoHanh = require("../models/PhieuBaoHanh");
const SanPham = require("../models/SanPham");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

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

const NHOM_MUA_GIUM = "Mua giùm nha khoa";

// Chuẩn hoá & kiểm tra các dòng sản phẩm "Mua giùm nha khoa":
// - Bắt buộc có ghi chú (tên món hàng) và đơn giá >= 0
// - Dòng thuộc nhóm khác: xoá donGia để không ghi đè bảng giá
// Trả về message lỗi (string) hoặc null nếu hợp lệ. Mutate trực tiếp mảng truyền vào.
const chuanHoaDongMuaGium = async (danhSachSanPham) => {
    if (!Array.isArray(danhSachSanPham) || danhSachSanPham.length === 0) return null;

    const spIds = [...new Set(danhSachSanPham.map((sp) => sp?.sanPham).filter(Boolean).map(String))];
    const muaGiumIds = new Set(
        (await SanPham.find({ _id: { $in: spIds }, nhomSanPham: NHOM_MUA_GIUM }).select("_id").lean())
            .map((sp) => String(sp._id))
    );

    for (let i = 0; i < danhSachSanPham.length; i++) {
        const sp = danhSachSanPham[i];
        if (!sp) continue;
        if (!muaGiumIds.has(String(sp.sanPham))) {
            sp.donGia = null;
            continue;
        }
        sp.ghiChu = (sp.ghiChu || "").trim();
        if (!sp.ghiChu) {
            return `Dòng ${i + 1}: Mua giùm nha khoa — vui lòng nhập tên món hàng ở ô Ghi chú`;
        }
        const donGia = Number(sp.donGia);
        if (sp.donGia === null || sp.donGia === undefined || sp.donGia === "" || !Number.isFinite(donGia) || donGia < 0) {
            return `Dòng ${i + 1}: Mua giùm nha khoa — vui lòng nhập đơn giá hợp lệ`;
        }
        sp.donGia = donGia;
        // Không áp dụng vị trí răng / màu / yêu cầu thử cho hàng mua giùm
        sp.viTri = [];
        sp.viTriText = "";
        sp.mau = "";
        sp.yeuCauThu = [];
    }
    return null;
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

        const loiMuaGium = await chuanHoaDongMuaGium(danhSachSanPham);
        if (loiMuaGium) {
            return res.status(400).json({ success: false, message: loiMuaGium });
        }


        // Sinh mã theo chuẩn: TAN + YY + MM + 4 số tăng dần trong tháng
        let maDonHang = await generateMaDonHang();
        let retry = 0;

        while (retry < 3) {
            try {
                const newDonHang = new DonHang({
                    ...req.body,
                    danhSachSanPham, // Chỉ lưu thông tin sản xuất, chưa snapshot giá
                    maDonHang,
                    trangThai: "Chờ xử lý",
                    buocThuHienTai: null,
                    nhatKyChinhSua: [{
                        nguoiThuc: req.body.nguoiThucDuyet || "Điều Phối",
                        hanhDong: "Tạo đơn hàng",
                        thoiGian: new Date(),
                    }],
                });
                await newDonHang.save();

                // Liên kết các ghi chú được tạo tạm thời từ form thêm mới đơn hàng
                const { ghiChuIds } = req.body;
                if (Array.isArray(ghiChuIds) && ghiChuIds.length > 0) {
                    const GhiChu = require("../models/GhiChu");
                    await GhiChu.updateMany(
                        { _id: { $in: ghiChuIds } },
                        {
                            $set: {
                                donHang: newDonHang._id,
                                maDonHang: newDonHang.maDonHang,
                            },
                        }
                    );
                }

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

// Tìm kiếm text: trả về điều kiện $or theo mã đơn / nha khoa / bệnh nhân / bác sĩ / sản phẩm
const buildSearchOr = async (search) => {
    if (!search || !search.trim()) return null;
    const regex = { $regex: search.trim(), $options: "i" };
    const [nkIds, bnIds, bsIds, spIds] = await Promise.all([
        NhaKhoa.find({ $or: [{ tenGiaoDich: regex }, { hoVaTen: regex }] }).distinct("_id"),
        BenhNhan.find({ hoVaTen: regex }).distinct("_id"),
        NguoiLienHe.find({ hoVaTen: regex }).distinct("_id"),
        SanPham.find({ tenSanPham: regex }).distinct("_id"),
    ]);
    const orConditions = [{ maDonHang: regex }];
    if (nkIds.length > 0) orConditions.push({ nhaKhoa: { $in: nkIds } });
    if (bnIds.length > 0) orConditions.push({ benhNhan: { $in: bnIds } });
    if (bsIds.length > 0) orConditions.push({ bacSi: { $in: bsIds } });
    if (spIds.length > 0) orConditions.push({ "danhSachSanPham.sanPham": { $in: spIds } });
    return orConditions;
};

// Đơn cũ (trước khi có lichSuHenLai): suy ra các lần dời hẹn giao từ nhật ký chỉnh sửa
const HEN_GIAO_LOG_REGEX =
    /Hẹn giao: (\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}) → (\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/;
const parseLichSuHenLaiTuNhatKy = (order) => {
    const result = [];
    for (const log of order.nhatKyChinhSua || []) {
        const m = HEN_GIAO_LOG_REGEX.exec(log.hanhDong || "");
        if (!m) continue;
        const cu = dayjs.tz(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00`, "Asia/Ho_Chi_Minh");
        const moi = dayjs.tz(`${m[8]}-${m[7]}-${m[6]}T${m[9]}:${m[10]}:00`, "Asia/Ho_Chi_Minh");
        if (moi.format("YYYY-MM-DD") <= cu.format("YYYY-MM-DD")) continue; // chỉ tính dời về sau
        result.push({
            henGiaoCu: cu.toDate(),
            henGiaoMoi: moi.toDate(),
            lyDo: "",
            nguoiThuc: log.nguoiThuc || "",
            thoiGian: log.thoiGian,
        });
    }
    // Lý do hiện tại của đơn gắn cho lần dời gần nhất
    if (result.length > 0) result[result.length - 1].lyDo = order.lyDoHenLai || "";
    return result;
};

// [GET] Đơn hẹn lại: tách 2 nhóm theo khoảng ngày [from, to]
//  - denNgay: được dời ĐẾN khoảng ngày (hẹn giao mới nằm trong khoảng)
//  - tuNgay : được dời ĐI KHỎI khoảng ngày (hẹn giao cũ nằm trong khoảng)
exports.getDonHangHenLai = async (req, res) => {
    try {
        const { from, to, search = "", nhaKhoa, trangThai } = req.query;
        const fromDate = from ? new Date(from) : null;
        const toDate = to ? new Date(to) : null;
        const inRange = (d) => {
            const t = new Date(d).getTime();
            return (!fromDate || t >= fromDate.getTime()) && (!toDate || t <= toDate.getTime());
        };

        const base = {};
        if (nhaKhoa) base.nhaKhoa = nhaKhoa;
        if (trangThai) base.trangThai = { $in: trangThai.split(",") };
        const searchOr = await buildSearchOr(search);
        if (searchOr) base.$or = searchOr;

        const range = {};
        if (fromDate) range.$gte = fromDate;
        if (toDate) range.$lte = toDate;
        const hasRange = Object.keys(range).length > 0;

        const henLaiConds = hasRange
            ? [
                { lichSuHenLai: { $elemMatch: { henGiaoMoi: range } } },
                { lichSuHenLai: { $elemMatch: { henGiaoCu: range } } },
            ]
            : [{ "lichSuHenLai.0": { $exists: true } }];
        // Đơn cũ chưa có lichSuHenLai nhưng nhật ký có ghi đổi hẹn giao
        henLaiConds.push({
            "lichSuHenLai.0": { $exists: false },
            "nhatKyChinhSua.hanhDong": { $regex: "Hẹn giao: " },
        });

        const orders = await DonHang.find({ ...base, $and: [{ $or: henLaiConds }] })
            .select("maDonHang nhaKhoa bacSi benhNhan danhSachSanPham ngayNhan henGiao trangThai ghiChuChung lyDoHenLai lichSuHenLai nhatKyChinhSua")
            .populate([
                { path: "nhaKhoa", select: "tenGiaoDich hoVaTen" },
                { path: "bacSi", select: "hoVaTen soDienThoai" },
                { path: "benhNhan", select: "hoVaTen soHoSo" },
                { path: "danhSachSanPham.sanPham", select: "tenSanPham" },
            ])
            .lean();

        const denNgay = [];
        const tuNgay = [];
        for (const order of orders) {
            const lichSu = order.lichSuHenLai?.length > 0
                ? order.lichSuHenLai
                : parseLichSuHenLaiTuNhatKy(order);
            const { nhatKyChinhSua: _nk, lichSuHenLai: _ls, ...orderInfo } = order;
            lichSu.forEach((ls, idx) => {
                const row = {
                    ...orderInfo,
                    henLaiKey: `${order._id}_${idx}`,
                    henGiaoCu: ls.henGiaoCu,
                    henGiaoMoi: ls.henGiaoMoi,
                    lyDoHenLaiDong: ls.lyDo || "",
                    thoiGianHenLai: ls.thoiGian,
                    nguoiHenLai: ls.nguoiThuc || "",
                };
                if (inRange(ls.henGiaoMoi)) denNgay.push(row);
                if (inRange(ls.henGiaoCu)) tuNgay.push(row);
            });
        }

        denNgay.sort((a, b) => new Date(a.henGiaoMoi) - new Date(b.henGiaoMoi));
        tuNgay.sort((a, b) => new Date(a.henGiaoCu) - new Date(b.henGiaoCu));

        res.status(200).json({ success: true, data: { denNgay, tuNgay } });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách đơn hẹn lại",
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
            sortBy,
        } = req.query;

        // Sắp xếp ổn định (có _id làm tie-break) để phân trang/infinite scroll không bị lệch
        const sortOpt = sortBy === "henGiao"
            ? { henGiao: 1, _id: 1 }
            : { createdAt: -1, _id: -1 };

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
        const searchOr = await buildSearchOr(search);
        if (searchOr) filter.$or = searchOr;

        const populateOpts = [
            { path: "nhaKhoa", select: "tenGiaoDich hoVaTen" },
            { path: "bacSi", select: "hoVaTen soDienThoai" },
            { path: "benhNhan", select: "hoVaTen soHoSo" },
            { path: "danhSachSanPham.sanPham", select: "tenSanPham donGiaChung loaiTinh nhomSanPham quyTrinh" },
        ];

        const now = new Date();
        const [donHangs, total, statsRaw, treHen] = await Promise.all([
            DonHang.find(filter)
                .populate(populateOpts)
                .sort(sortOpt)
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
            .populate("danhSachSanPham.sanPham", "tenSanPham donGiaChung loaiTinh nhomSanPham quyTrinh baoHanhMacDinh")
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
    return dayjs(d).tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY HH:mm");
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
        ["lyDoHenLai", "Lý do hẹn lại"],
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
            // Đơn giá nhập tay (Mua giùm nha khoa)
            const oldDonGia = oldSp.donGia ?? null;
            const newDonGia = newSp.donGia ?? null;
            if (oldDonGia !== newDonGia) {
                const fmt = (v) => (v === null ? "(trống)" : Number(v).toLocaleString("vi-VN"));
                changes.push(`${spLabel} - Đơn giá: ${fmt(oldDonGia)} → ${fmt(newDonGia)}`);
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
        const { nhatKyLogEntry, nhatKyChinhSua: _nhatKy, nguoiThucDuyet: _nguoi, lichSuHenLai: _lichSu, ...updateData } = req.body;

        // Lấy đơn hàng hiện tại để kiểm tra trạng thái khoá và so sánh thay đổi
        const donHangHienTai = await DonHang.findById(req.params.id)
            .select("trangThai daXuatHoaDon ngayNhan yeuCauHoanThanh henGiao bacSi chiDinhBacSi ghiChuChung ghiChuTaiChinh ghiChuSanXuat lyDoHenLai danhSachSanPham danhSachPhuKien")
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

        const deliveryTimePermission = "/don-hang/sua-gio-giao";
        if (Object.prototype.hasOwnProperty.call(updateData, "henGiao")) {
            const oldDeliveryTime = donHangHienTai.henGiao ? new Date(donHangHienTai.henGiao).getTime() : null;
            const newDeliveryTime = updateData.henGiao ? new Date(updateData.henGiao).getTime() : null;
            if (oldDeliveryTime !== newDeliveryTime && !req.user?.permissions?.includes(deliveryTimePermission)) {
                return res.status(403).json({
                    success: false,
                    message: "Bạn không có quyền sửa giờ giao của đơn hàng",
                    requiredPermission: deliveryTimePermission,
                });
            }
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

        if ("danhSachSanPham" in updateData) {
            const loiMuaGium = await chuanHoaDongMuaGium(updateData.danhSachSanPham);
            if (loiMuaGium) {
                return res.status(400).json({ success: false, message: loiMuaGium });
            }
        }

        // Xây dựng mô tả chi tiết những gì đã thay đổi
        const chiTietThayDoi = await buildChinhSuaLog(donHangHienTai, updateData);

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

        // Dời ngày hẹn giao về sau (so theo ngày giờ VN) → ghi lịch sử hẹn lại
        if (updateData.henGiao && donHangHienTai.henGiao) {
            const ngayCu = dayjs(donHangHienTai.henGiao).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD");
            const ngayMoi = dayjs(updateData.henGiao).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD");
            if (ngayMoi > ngayCu) {
                updateOp.$push = {
                    ...(updateOp.$push || {}),
                    lichSuHenLai: {
                        henGiaoCu: donHangHienTai.henGiao,
                        henGiaoMoi: new Date(updateData.henGiao),
                        lyDo: (updateData.lyDoHenLai || "").trim(),
                        nguoiThuc: nhatKyLogEntry?.nguoiThuc || "",
                        thoiGian: new Date(),
                    },
                };
            }
        }

        const updatedDonHang = await DonHang.findByIdAndUpdate(req.params.id, updateOp, { new: true })
            .populate("nhaKhoa", "hoVaTen tenGiaoDich soDienThoai email diaChiCuThe")
            .populate("bacSi", "hoVaTen soDienThoai email")
            .populate("benhNhan", "hoVaTen soHoSo soDienThoai")
            .populate("danhSachSanPham.sanPham", "tenSanPham donGiaChung loaiTinh nhomSanPham quyTrinh baoHanhMacDinh")
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

// [PATCH] Cập nhật trạng thái đơn hàng theo luồng yêu cầu thử
exports.updateTrangThai = async (req, res) => {
    try {
        const { trangThai, buocThuHienTai, nguoiThuc } = req.body;
        const VALID_TRANG_THAI = ["Chờ xử lý", "Đang sản xuất", "Đang thử", "Hoàn thành", "Đã giao"];
        if (!trangThai || !VALID_TRANG_THAI.includes(trangThai)) {
            return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
        }
        const updateSet = { trangThai };
        if (buocThuHienTai !== undefined && buocThuHienTai !== null) {
            updateSet.buocThuHienTai = buocThuHienTai;
        }
        const updated = await DonHang.findByIdAndUpdate(
            req.params.id,
            {
                $set: updateSet,
                $push: {
                    nhatKyChinhSua: {
                        nguoiThuc: nguoiThuc || "Điều Phối",
                        hanhDong: `Chuyển trạng thái → "${trangThai}"`,
                        thoiGian: new Date(),
                    },
                },
            },
            { new: true }
        )
            .populate("nhaKhoa", "hoVaTen tenGiaoDich soDienThoai email diaChiCuThe")
            .populate("bacSi", "hoVaTen soDienThoai email")
            .populate("benhNhan", "hoVaTen soHoSo soDienThoai")
            .populate("danhSachSanPham.sanPham", "tenSanPham donGiaChung loaiTinh nhomSanPham quyTrinh baoHanhMacDinh")
            .populate("danhSachSanPham.donHangCu");
        if (!updated) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        }
        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi cập nhật trạng thái", error: error.message });
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
        await donHang.populate("danhSachSanPham.sanPham", "tenSanPham donGiaChung loaiTinh nhomSanPham quyTrinh baoHanhMacDinh");
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
                trangThai: { $nin: ["Hoàn thành", "Đã giao"] },
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
