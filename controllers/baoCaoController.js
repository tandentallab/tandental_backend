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

// ─────────────────────────────────────────────────────────────────────────────
// API 3: Sản lượng theo khách hàng (Nha khoa)
// ─────────────────────────────────────────────────────────────────────────────
exports.getSanLuongTheoKhachHang = async (req, res) => {
    try {
        const { startDate, endDate, loaiDon } = req.query;
        const { start, end } = normalizeRange(startDate, endDate);

        let loaiDonArray = ["Mới"];
        if (loaiDon) {
            if (Array.isArray(loaiDon)) {
                loaiDonArray = loaiDon;
            } else {
                loaiDonArray = loaiDon.split(",").map(item => item.trim());
            }
        }

        const reportData = await DonHang.aggregate([
            // Bước 1: Lọc theo ngày nhận
            { $match: { ngayNhan: { $gte: start, $lte: end } } },

            // Bước 2: Tách mảng sản phẩm ra để tính số lượng
            { $unwind: "$danhSachSanPham" },

            // Bước 3: Lọc theo loại đơn
            { $match: { "danhSachSanPham.loaiDon": { $in: loaiDonArray } } },

            // Bước 4: Gom nhóm theo _id nha khoa
            {
                $group: {
                    _id: "$nhaKhoa",
                    tongSanLuong: { $sum: "$danhSachSanPham.soLuong" }
                }
            },

            // Bước 5: Nối bảng để lấy thông tin Khách hàng
            {
                $lookup: {
                    from: "nhakhoas", // Chuẩn tên collection trong DB
                    localField: "_id",
                    foreignField: "_id",
                    as: "nhaKhoaInfo"
                }
            },
            { $unwind: { path: "$nhaKhoaInfo", preserveNullAndEmptyArrays: true } },

            // 🌟 TÙY CHỌN QUAN TRỌNG: 
            // Nếu muốn ẨN HOÀN TOÀN các đơn hàng của Khách hàng đã bị xóa khỏi báo cáo, 
            // bạn chỉ cần bỏ comment (//) ở dòng ngay bên dưới:
            // { $match: { "nhaKhoaInfo._id": { $exists: true } } },

            {
                $project: {
                    _id: 0,
                    nhaKhoaId: "$_id",
                    tongSanLuong: 1,
                    // Dùng $let để gán biến và $trim để lọc sạch dấu cách rác " "
                    tenNhaKhoa: {
                        $let: {
                            vars: {
                                hvt: { $trim: { input: { $ifNull: ["$nhaKhoaInfo.hoVaTen", ""] } } },
                                tgd: { $trim: { input: { $ifNull: ["$nhaKhoaInfo.tenGiaoDich", ""] } } }
                            },
                            in: {
                                $cond: [
                                    { $ne: ["$$hvt", ""] }, // Ưu tiên 1: Nếu Họ và Tên có chữ -> LẤY
                                    "$$hvt",
                                    {
                                        $cond: [
                                            { $ne: ["$$tgd", ""] }, // Ưu tiên 2: Nếu trống Họ Tên mà có Tên Giao Dịch -> LẤY
                                            "$$tgd",
                                            "Khách hàng đã xóa (Mồ côi)" // Cả 2 đều trống trơn -> MỒ CÔI
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            // Bước 7: Sắp xếp giảm dần theo sản lượng
            { $sort: { tongSanLuong: -1 } }
        ]);

        // Tính tổng toàn bộ hiển thị dưới chân bảng
        const tongTatCa = reportData.reduce((sum, item) => sum + item.tongSanLuong, 0);

        res.status(200).json({
            success: true,
            loaiDonDaLoc: loaiDonArray,
            tongTatCa: tongTatCa,
            data: reportData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDoanhThuThang = async (req, res) => {
    try {
        const thang = parseInt(req.query.thang) || new Date().getMonth() + 1;
        const nam = parseInt(req.query.nam) || new Date().getFullYear();

        const startOfMonth = dayjs.tz(`${nam}-${String(thang).padStart(2, "0")}-01`, VN_TZ).startOf("month").toDate();
        const endOfMonth = dayjs(startOfMonth).tz(VN_TZ).endOf("month").toDate();

        // ── 1. AGGREGATE HÓA ĐƠN ──
        const hdStats = await HoaDon.aggregate([
            // 🔥 Pro-tip: Nên loại trừ luôn cả Hóa đơn "Đã hủy" (nếu hệ thống sếp có)
            { $match: { trangThai: { $nin: ["Lưu tạm", "Đã hủy"] } } },
            {
                $group: {
                    _id: "$nhaKhoa",
                    phatSinhTruoc: {
                        $sum: { $cond: [{ $lt: ["$ngayXuatHoaDon", startOfMonth] }, "$giaTriThanhToan", 0] }
                    },
                    phatSinhTrong: {
                        $sum: {
                            $cond: [
                                { $and: [{ $gte: ["$ngayXuatHoaDon", startOfMonth] }, { $lte: ["$ngayXuatHoaDon", endOfMonth] }] },
                                "$giaTriThanhToan", 0
                            ]
                        }
                    }
                }
            }
        ]);

        // ── 2. AGGREGATE PHIẾU THU ──
        const ptStats = await PhieuThu.aggregate([
            // 🔥 Pro-tip: Tương tự, nhớ loại trừ Phiếu thu "Đã hủy" (nếu có)
            { $match: { nhaKhoa: { $ne: null }, trangThai: { $ne: "Đã hủy" } } },
            {
                $group: {
                    _id: "$nhaKhoa",
                    thanhToanTruoc: {
                        $sum: { $cond: [{ $lt: ["$ngayThu", startOfMonth] }, "$soTienThu", 0] }
                    },
                    thanhToanTrong: {
                        $sum: {
                            $cond: [
                                { $and: [{ $gte: ["$ngayThu", startOfMonth] }, { $lte: ["$ngayThu", endOfMonth] }] },
                                "$soTienThu", 0
                            ]
                        }
                    }
                }
            }
        ]);

        // ── 3. LẤY DANH SÁCH NHA KHOA ──
        const nhaKhoaList = await NhaKhoa.find({}, "tenGiaoDich hoVaTen ghiChuThang").lean(); // ko cần gọi soDuDauKy ra luôn cho nhẹ

        const hdMap = hdStats.reduce((m, x) => { m[x._id.toString()] = x; return m; }, {});
        const ptMap = ptStats.reduce((m, x) => { m[x._id.toString()] = x; return m; }, {});

        let tongNoDauKy = 0, tongPhatSinh = 0, tongThanhToan = 0, tongConNo = 0;
        const chiTiet = [];

        // ── 4. TÍNH TOÁN BÁO CÁO (Siêu gọn) ──
        for (const nk of nhaKhoaList) {
            const id = nk._id.toString();
            const hd = hdMap[id] || { phatSinhTruoc: 0, phatSinhTrong: 0 };
            const pt = ptMap[id] || { thanhToanTruoc: 0, thanhToanTrong: 0 };

            // 🚀 Thuật toán xịn là thuật toán không cần if/else. Cứ để Data tự lên tiếng!
            const noDauKy = Math.round(hd.phatSinhTruoc - pt.thanhToanTruoc);
            const phatSinh = Math.round(hd.phatSinhTrong);
            const thanhToan = Math.round(pt.thanhToanTrong);
            const conNo = Math.round(noDauKy + phatSinh - thanhToan);

            // Bỏ qua các phòng khám không có biến động tài chính
            if (noDauKy !== 0 || phatSinh !== 0 || thanhToan !== 0 || conNo !== 0) {
                tongNoDauKy += noDauKy;
                tongPhatSinh += phatSinh;
                tongThanhToan += thanhToan;
                tongConNo += conNo;

                const ghiChuEntry = (nk.ghiChuThang || []).find(g => g.thang === thang && g.nam === nam);

                chiTiet.push({
                    nhaKhoaId: id,
                    tenNhaKhoa: nk.tenGiaoDich || nk.hoVaTen || "—",
                    noDauKy,
                    phatSinh,
                    thanhToan,
                    conNo,
                    ghiChu: ghiChuEntry?.noiDung || '',
                });
            }
        }

        chiTiet.sort((a, b) => a.tenNhaKhoa.localeCompare(b.tenNhaKhoa, "vi"));
        const chiTietWithStt = chiTiet.map((r, i) => ({ ...r, stt: i + 1 }));

        res.json({
            success: true,
            thang, nam,
            tongHop: { noDauKy: tongNoDauKy, phatSinh: tongPhatSinh, thanhToan: tongThanhToan, conNo: tongConNo },
            chiTiet: chiTietWithStt,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};