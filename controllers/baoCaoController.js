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

        // ── 1. AGGREGATE HÓA ĐƠN: Tính Phát Sinh Thuần & Chốt Nợ Khởi Tạo ──
        const hdStats = await HoaDon.aggregate([
            { $sort: { createdAt: 1 } }, // Cũ nhất lên đầu để lấy firstNoDauKy
            {
                $group: {
                    _id: "$nhaKhoa",
                    // Nợ gốc khởi tạo hệ thống vĩnh viễn nằm ở Hóa đơn đầu tiên
                    tongSoDuMigrate: { $sum: "$soDuMigrate" },

                    phatSinhTruoc: {
                        $sum: {
                            $cond: [
                                { $lt: ["$ngayXuatHoaDon", startOfMonth] },
                                {
                                    $add: [
                                        { $subtract: ["$tongCong", "$chietKhau"] },
                                        { $multiply: [{ $subtract: ["$tongCong", "$chietKhau"] }, { $divide: ["$thue", 100] }] },
                                        "$chiPhiKhac"
                                    ]
                                },
                                0
                            ]
                        }
                    },
                    phatSinhTrong: {
                        $sum: {
                            $cond: [
                                { $and: [{ $gte: ["$ngayXuatHoaDon", startOfMonth] }, { $lte: ["$ngayXuatHoaDon", endOfMonth] }] },
                                {
                                    $add: [
                                        { $subtract: ["$tongCong", "$chietKhau"] },
                                        { $multiply: [{ $subtract: ["$tongCong", "$chietKhau"] }, { $divide: ["$thue", 100] }] },
                                        "$chiPhiKhac"
                                    ]
                                },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        // ── 2. AGGREGATE PHIẾU THU: Dòng tiền thực tế khách đã nộp ──
        const ptStats = await PhieuThu.aggregate([
            // Tìm nhaKhoa thông qua hóa đơn đầu tiên trong danh sách của phiếu thu
            {
                $lookup: {
                    from: "hoadons",
                    localField: "danhSachHoaDon.hoaDon",
                    foreignField: "_id",
                    as: "hdList"
                }
            },
            { $unwind: { path: "$hdList", preserveNullAndEmptyArrays: true } },
            // Group lại theo _id Phiếu Thu để không bị nhân đôi soTienThu nếu phiếu trả cho nhiều bill
            {
                $group: {
                    _id: "$_id",
                    nhaKhoa: { $first: "$hdList.nhaKhoa" },
                    ngayThu: { $first: "$ngayThu" },
                    soTienThu: { $first: "$soTienThu" } // Lấy tổng tiền nộp thực tế
                }
            },
            { $match: { nhaKhoa: { $ne: null } } },
            // Group theo Nha Khoa để cộng dồn tiền
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

        // ── 3. LẤY DANH SÁCH NHA KHOA ĐỂ MAP DATA ──
        const nhaKhoaList = await NhaKhoa.find({}, "tenGiaoDich hoVaTen soDuDauKy").lean();

        const hdMap = hdStats.reduce((m, x) => { m[x._id.toString()] = x; return m; }, {});
        const ptMap = ptStats.reduce((m, x) => { m[x._id.toString()] = x; return m; }, {});

        // ── 4. TÍNH TOÁN BÁO CÁO TOÀN DIỆN ──
        let tongNoDauKy = 0, tongPhatSinh = 0, tongThanhToan = 0, tongConNo = 0;
        const chiTiet = [];

        for (const nk of nhaKhoaList) {
            const id = nk._id.toString();
            // Cập nhật lại giá trị mặc định theo biến mới gán ở Vị trí 1
            const hd = hdMap[id] || { tongSoDuMigrate: 0, phatSinhTruoc: 0, phatSinhTrong: 0 };
            const pt = ptMap[id] || { thanhToanTruoc: 0, thanhToanTrong: 0 };

            let noDauKy = 0;

            const arrSoDu = Array.isArray(nk.soDuDauKy) ? nk.soDuDauKy : [];
            const manualSoDu = arrSoDu.find(item => item.thang === thang && item.nam === nam);

            if (manualSoDu) {
                noDauKy = manualSoDu.soTien;
            } else {
                let noGocBanDau = 0;
                if (hdMap[id]) {
                    // 🔥 THAY THẾ TẠI ĐÂY: Lấy dữ liệu ổn định từ tổng số dư migrate thay vì firstNoDauKy
                    noGocBanDau = hd.tongSoDuMigrate;
                } else if (arrSoDu.length > 0) {
                    const oldest = [...arrSoDu].sort((a, b) => (a.nam - b.nam) || (a.thang - b.thang))[0];

                    if (nam < oldest.nam || (nam === oldest.nam && thang < oldest.thang)) {
                        noGocBanDau = 0;
                    } else {
                        noGocBanDau = oldest.soTien;
                    }
                }
                noDauKy = Math.round(noGocBanDau + hd.phatSinhTruoc - pt.thanhToanTruoc);
            }

            const phatSinh = Math.round(hd.phatSinhTrong);
            const thanhToan = Math.round(pt.thanhToanTrong);
            const conNo = Math.round(noDauKy + phatSinh - thanhToan);

            if (noDauKy !== 0 || phatSinh !== 0 || thanhToan !== 0 || conNo !== 0) {
                tongNoDauKy += noDauKy;
                tongPhatSinh += phatSinh;
                tongThanhToan += thanhToan;
                tongConNo += conNo;

                chiTiet.push({
                    nhaKhoaId: id,
                    tenNhaKhoa: nk.tenGiaoDich || nk.hoVaTen || "—",
                    noDauKy,
                    phatSinh,
                    thanhToan,
                    conNo
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