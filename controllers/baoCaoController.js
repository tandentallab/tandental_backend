const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const DonHang = require("../models/DonHang");
const SanPham = require("../models/SanPham");
const HoaDon = require("../models/HoaDon");
const PhieuThu = require("../models/PhieuThu");
const NhaKhoa = require("../models/NhaKhoa");
const VN_TZ = "Asia/Ho_Chi_Minh"; // UTC+7

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Chuẩn hóa khoảng ngày theo múi giờ Việt Nam
//   Nhất quán 100% với dashboardController — dùng dayjs.tz()
//   startDate "YYYY-MM-DD" → 00:00:00.000 giờ VN
//   endDate   "YYYY-MM-DD" → 23:59:59.999 giờ VN
// ─────────────────────────────────────────────────────────────────────────────
const normalizeRange = (startDate, endDate) => {
    if (!startDate || !endDate) {
        const now = dayjs().tz(VN_TZ);
        return {
            start: now.startOf("month").toDate(),
            end: now.endOf("day").toDate(),
        };
    }
    // Cắt phần YYYY-MM-DD nếu frontend gửi ISO string đầy đủ
    const startStr = String(startDate).split("T")[0];
    const endStr = String(endDate).split("T")[0];

    return {
        start: dayjs.tz(startStr, VN_TZ).startOf("day").toDate(),
        end: dayjs.tz(endStr, VN_TZ).endOf("day").toDate(),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// API 1: Top 10 sản phẩm (Biểu đồ)
// ─────────────────────────────────────────────────────────────────────────────
exports.getTopProductsReport = async (req, res) => {
    try {
        const { startDate, endDate, dateType = "ngayNhan" } = req.query;
        const { start, end } = normalizeRange(startDate, endDate);
        const matchField = dateType === "henGiao" ? "henGiao" : "ngayNhan";

        const topProducts = await DonHang.aggregate([
            { $match: { [matchField]: { $gte: start, $lte: end } } },
            { $unwind: "$danhSachSanPham" },
            {
                $group: {
                    _id: "$danhSachSanPham.sanPham",
                    quantity: { $sum: "$danhSachSanPham.soLuong" },
                },
            },
            { $sort: { quantity: -1 } },
            { $limit: 10 },
            { $addFields: { productObjectId: { $toObjectId: "$_id" } } },
            {
                $lookup: {
                    from: "sanphams",
                    localField: "productObjectId",
                    foreignField: "_id",
                    as: "productInfo",
                },
            },
            { $unwind: "$productInfo" },
            { $project: { _id: 0, name: "$productInfo.tenSanPham", quantity: 1 } },
        ]);

        res.status(200).json({ success: true, data: topProducts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 2: Báo cáo chi tiết 3 tầng (Bảng)
// ─────────────────────────────────────────────────────────────────────────────
exports.getDetailedProductReport = async (req, res) => {
    try {
        const { startDate, endDate, dateType = "ngayNhan" } = req.query;
        const { start, end } = normalizeRange(startDate, endDate);
        const matchField = dateType === "henGiao" ? "henGiao" : "ngayNhan";

        const reportData = await DonHang.aggregate([
            { $match: { [matchField]: { $gte: start, $lte: end } } },

            // 1. Tách mảng sản phẩm trong Đơn hàng
            { $unwind: "$danhSachSanPham" },

            // 2. Nối sang bảng SanPham CHỈ ĐỂ lấy Tên SP, Loại SP
            {
                $lookup: {
                    from: "sanphams",
                    localField: "danhSachSanPham.sanPham",
                    foreignField: "_id",
                    as: "productInfo",
                },
            },
            { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },

            {
                // Gom theo (loaiSP, nhomSP, tenSP) — đếm từng loaiDon bằng $eq
                $group: {
                    _id: {
                        loaiSP: "$productInfo.loaiSanPham",
                        nhomSP: "$productInfo.nhomSanPham",
                        tenSP: "$productInfo.tenSanPham",
                    },
                    moi: { $sum: { $cond: [{ $eq: ["$danhSachSanPham.loaiDon", "Mới"] }, "$danhSachSanPham.soLuong", 0] } },
                    sua: { $sum: { $cond: [{ $eq: ["$danhSachSanPham.loaiDon", "Hàng sửa"] }, "$danhSachSanPham.soLuong", 0] } },
                    baoHanh: { $sum: { $cond: [{ $eq: ["$danhSachSanPham.loaiDon", "Hàng bảo hành"] }, "$danhSachSanPham.soLuong", 0] } },
                    lamLai: { $sum: { $cond: [{ $eq: ["$danhSachSanPham.loaiDon", "Hàng làm lại"] }, "$danhSachSanPham.soLuong", 0] } },
                    tong: { $sum: "$danhSachSanPham.soLuong" },
                },
            },
            {
                // Tầng 2: Gom theo (loaiSanPham, nhomSanPham)
                $group: {
                    _id: { loaiSP: "$_id.loaiSP", nhomSP: "$_id.nhomSP" },
                    products: {
                        $push: {
                            ten: "$_id.tenSP",
                            moi: "$moi", sua: "$sua", baoHanh: "$baoHanh", lamLai: "$lamLai", tong: "$tong",
                        },
                    },
                    n_moi: { $sum: "$moi" }, n_sua: { $sum: "$sua" },
                    n_bh: { $sum: "$baoHanh" }, n_ll: { $sum: "$lamLai" },
                    n_tong: { $sum: "$tong" },
                },
            },
            {
                // Tầng 3: Gom theo loaiSanPham
                $group: {
                    _id: "$_id.loaiSP",
                    groups: {
                        $push: {
                            tenNhom: "$_id.nhomSP",
                            products: "$products",
                            moi: "$n_moi", sua: "$n_sua", baoHanh: "$n_bh", lamLai: "$n_ll", tong: "$n_tong",
                        },
                    },
                    t_moi: { $sum: "$n_moi" }, t_sua: { $sum: "$n_sua" },
                    t_bh: { $sum: "$n_bh" }, t_ll: { $sum: "$n_ll" },
                    t_tong: { $sum: "$n_tong" },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        res.status(200).json({ success: true, data: reportData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDoanhThuThang = async (req, res) => {
    try {
        const thang = parseInt(req.query.thang) || new Date().getMonth() + 1;
        const nam = parseInt(req.query.nam) || new Date().getFullYear();

        const startOfMonth = dayjs
            .tz(`${nam}-${String(thang).padStart(2, "0")}-01`, VN_TZ)
            .startOf("day")
            .toDate();
        const endOfMonth = dayjs(startOfMonth)
            .tz(VN_TZ)
            .endOf("month")
            .toDate();

        // ── 1. HoaDon: Tính Phát sinh trong tháng & Nợ cũ trước tháng ──────────
        const [hdFacet] = await HoaDon.aggregate([
            {
                $facet: {
                    trongThang: [
                        { $match: { ngayXuatHoaDon: { $gte: startOfMonth, $lte: endOfMonth } } },
                        // SỬA Ở ĐÂY: Thay $thanhTien thành $giaTriThanhToan (tổng tiền hóa đơn)
                        { $group: { _id: "$nhaKhoa", phatSinh: { $sum: "$giaTriThanhToan" } } },
                    ],
                    truocThang: [
                        { $match: { ngayXuatHoaDon: { $lt: startOfMonth } } },
                        // SỬA Ở ĐÂY: Thay $thanhTien thành $giaTriThanhToan
                        { $group: { _id: "$nhaKhoa", tong: { $sum: "$giaTriThanhToan" } } },
                    ],
                },
            },
        ]);

        // ── 2. PhieuThu: Tính Tiền thanh toán ──────────────────────────────────
        const [ptFacet] = await PhieuThu.aggregate([
            // B1: Tách mảng danhSachHoaDon ra thành từng dòng riêng biệt
            { $unwind: "$danhSachHoaDon" },
            // B2: Lookup lấy thông tin Hóa đơn tương ứng với từng dòng
            {
                $lookup: {
                    from: "hoadons", // Đảm bảo tên collection này đúng trong MongoDB (thường là số nhiều viết thường)
                    localField: "danhSachHoaDon.hoaDon",
                    foreignField: "_id",
                    as: "hd",
                },
            },
            { $unwind: "$hd" },
            // B3: Tính tổng tiền thanh toán dựa trên "soTienThanhToan" của từng hóa đơn
            {
                $facet: {
                    trongThang: [
                        { $match: { ngayThu: { $gte: startOfMonth, $lte: endOfMonth } } },
                        { $group: { _id: "$hd.nhaKhoa", thanhToan: { $sum: "$danhSachHoaDon.soTienThanhToan" } } },
                    ],
                    truocThang: [
                        { $match: { ngayThu: { $lt: startOfMonth } } },
                        { $group: { _id: "$hd.nhaKhoa", tong: { $sum: "$danhSachHoaDon.soTienThanhToan" } } },
                    ],
                },
            },
        ]);

        // ── 3. Map để tra cứu nhanh O(1) ─────────────────────────────────────
        const toMap = (arr) =>
            arr.reduce((m, x) => { m[x._id?.toString()] = x; return m; }, {});

        const hdTrong = toMap(hdFacet.trongThang);
        const hdTruoc = toMap(hdFacet.truocThang);
        const ptTrong = toMap(ptFacet.trongThang);
        const ptTruoc = toMap(ptFacet.truocThang);

        // ── 4. Gộp tất cả NhaKhoa có dữ liệu (có nợ, có phát sinh hoặc có trả tiền)
        const allIds = new Set([
            ...hdFacet.trongThang, ...hdFacet.truocThang,
            ...ptFacet.trongThang, ...ptFacet.truocThang,
        ].map(x => x._id?.toString()).filter(Boolean));

        const nhaKhoaList = await NhaKhoa.find(
            { _id: { $in: [...allIds] } },
            "tenGiaoDich hoVaTen"
        ).lean();

        const nkMap = nhaKhoaList.reduce((m, x) => { m[x._id.toString()] = x; return m; }, {});

        // ── 5. Tính toán Nợ đầu kỳ, Phát Sinh, Thanh Toán, Cuối Kỳ ──────────
        let tongNoDauKy = 0, tongPhatSinh = 0, tongThanhToan = 0, tongConNo = 0;

        const chiTiet = [...allIds]
            .map((id) => {
                const tenNhaKhoa = nkMap[id]?.tenGiaoDich || nkMap[id]?.hoVaTen || "—";

                // Nợ đầu kỳ = Tổng nợ cũ - Tổng đã trả cũ
                const noDauKy = (hdTruoc[id]?.tong || 0) - (ptTruoc[id]?.tong || 0);

                // Trong kỳ
                const phatSinh = hdTrong[id]?.phatSinh || 0;
                const thanhToan = ptTrong[id]?.thanhToan || 0;

                // Nợ cuối kỳ = Nợ đầu + Phát sinh - Đã trả
                const conNo = noDauKy + phatSinh - thanhToan;

                tongNoDauKy += noDauKy;
                tongPhatSinh += phatSinh;
                tongThanhToan += thanhToan;
                tongConNo += conNo;

                return { nhaKhoaId: id, tenNhaKhoa, noDauKy, phatSinh, thanhToan, conNo };
            })
            // Chỉ hiển thị nha khoa nào có biến động tiền bạc
            .filter(r => r.noDauKy !== 0 || r.phatSinh !== 0 || r.thanhToan !== 0 || r.conNo !== 0)
            // Sắp xếp theo tên A-Z
            .sort((a, b) => a.tenNhaKhoa.localeCompare(b.tenNhaKhoa, "vi"))
            .map((r, i) => ({ ...r, stt: i + 1 }));

        res.json({
            success: true,
            thang,
            nam,
            tongHop: { noDauKy: tongNoDauKy, phatSinh: tongPhatSinh, thanhToan: tongThanhToan, conNo: tongConNo },
            chiTiet,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};