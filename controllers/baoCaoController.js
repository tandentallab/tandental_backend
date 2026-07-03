const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const mongoose = require("mongoose");
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
// ─────────────────────────────────────────────────────────────────────────────
const normalizeRange = (startDate, endDate) => {
    if (!startDate || !endDate) {
        const now = dayjs().tz(VN_TZ);
        return {
            start: now.startOf("month").toDate(),
            end: now.endOf("day").toDate(),
        };
    }
    const startStr = String(startDate).split("T")[0];
    const endStr = String(endDate).split("T")[0];
    return {
        start: dayjs.tz(startStr, VN_TZ).startOf("day").toDate(),
        end: dayjs.tz(endStr, VN_TZ).endOf("day").toDate(),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Resolve giá cho từng dòng sản phẩm của DonHang
//
// Ưu tiên:
//   1. Đơn đã xuất HĐ → donGia snapshot từ HoaDon (cố định)
//   2. Đơn chưa xuất HĐ → giá riêng từ BangGia
//   3. Fallback → donGiaChung từ SanPham
// ─────────────────────────────────────────────────────────────────────────────
const buildGiaPipeline = () => [
    // B1: Lookup HoaDon — tìm dòng sản phẩm khớp sanPhamDonHangId = danhSachSanPham._id
    {
        $lookup: {
            from: "hoadons",
            let: { subDocId: "$danhSachSanPham._id" },
            pipeline: [
                { $match: { trangThai: { $ne: "Lưu tạm" } } },
                { $unwind: "$danhSachSanPham" },
                {
                    $match: {
                        $expr: { $eq: ["$danhSachSanPham.sanPhamDonHangId", "$$subDocId"] }
                    }
                },
                { $project: { _id: 0, donGiaHoaDon: "$danhSachSanPham.donGia" } },
                { $limit: 1 }
            ],
            as: "hoaDonMatch"
        }
    },

    // B2: Lookup BangGia — giá riêng theo (nhaKhoa + sanPham)
    {
        $lookup: {
            from: "banggias",
            let: { nkId: "$nhaKhoa", spId: "$danhSachSanPham.sanPham" },
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ["$nhaKhoaId", "$$nkId"] },
                                { $eq: ["$sanPhamId", "$$spId"] }
                            ]
                        }
                    }
                },
                { $project: { _id: 0, donGia: 1 } },
                { $limit: 1 }
            ],
            as: "bangGiaInfo"
        }
    },

    // B3: Lookup SanPham — fallback giá chung
    {
        $lookup: {
            from: "sanphams",
            localField: "danhSachSanPham.sanPham",
            foreignField: "_id",
            as: "sanPhamInfo"
        }
    },
    { $unwind: { path: "$sanPhamInfo", preserveNullAndEmptyArrays: true } },

    // B4: Xác định donGiaApDung
    {
        $addFields: {
            donGiaApDung: {
                $cond: {
                    if: { $gt: [{ $size: "$hoaDonMatch" }, 0] },
                    then: { $arrayElemAt: ["$hoaDonMatch.donGiaHoaDon", 0] },
                    else: {
                        $ifNull: [
                            { $arrayElemAt: ["$bangGiaInfo.donGia", 0] },
                            "$sanPhamInfo.donGiaChung"
                        ]
                    }
                }
            }
        }
    }
];

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
            { $match: { "danhSachSanPham.loaiDon": "Mới" } },
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
            { $unwind: "$danhSachSanPham" },
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
            loaiDonArray = Array.isArray(loaiDon)
                ? loaiDon
                : loaiDon.split(",").map(item => item.trim());
        }

        const reportData = await DonHang.aggregate([
            { $match: { ngayNhan: { $gte: start, $lte: end } } },
            { $unwind: "$danhSachSanPham" },
            { $match: { "danhSachSanPham.loaiDon": { $in: loaiDonArray } } },
            {
                $group: {
                    _id: "$nhaKhoa",
                    tongSanLuong: { $sum: "$danhSachSanPham.soLuong" }
                }
            },
            {
                $lookup: {
                    from: "nhakhoas",
                    localField: "_id",
                    foreignField: "_id",
                    as: "nhaKhoaInfo"
                }
            },
            { $unwind: { path: "$nhaKhoaInfo", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    nhaKhoaId: "$_id",
                    tongSanLuong: 1,
                    tenNhaKhoa: {
                        $let: {
                            vars: {
                                hvt: { $trim: { input: { $ifNull: ["$nhaKhoaInfo.hoVaTen", ""] } } },
                                tgd: { $trim: { input: { $ifNull: ["$nhaKhoaInfo.tenGiaoDich", ""] } } }
                            },
                            in: {
                                $cond: [
                                    { $ne: ["$$hvt", ""] }, "$$hvt",
                                    { $cond: [{ $ne: ["$$tgd", ""] }, "$$tgd", "Khách hàng đã xóa (Mồ côi)"] }
                                ]
                            }
                        }
                    }
                }
            },
            { $sort: { tongSanLuong: -1 } }
        ]);

        const tongTatCa = reportData.reduce((sum, item) => sum + item.tongSanLuong, 0);
        res.status(200).json({ success: true, loaiDonDaLoc: loaiDonArray, tongTatCa, data: reportData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 4: Doanh số theo khách hàng (Nha khoa)
// ─────────────────────────────────────────────────────────────────────────────
exports.getDoanhSoTheoKhachHang = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const { start, end } = normalizeRange(startDate, endDate);

        const reportData = await DonHang.aggregate([
            { $match: { ngayNhan: { $gte: start, $lte: end } } },
            { $unwind: "$danhSachSanPham" },
            { $match: { "danhSachSanPham.loaiDon": "Mới" } },
            ...buildGiaPipeline(),
            {
                $lookup: {
                    from: "nhakhoas",
                    localField: "nhaKhoa",
                    foreignField: "_id",
                    as: "nhaKhoaInfo"
                }
            },
            { $unwind: { path: "$nhaKhoaInfo", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: "$nhaKhoa",
                    tongSoLuong: { $sum: "$danhSachSanPham.soLuong" },
                    tongDoanhSo: { $sum: { $multiply: ["$danhSachSanPham.soLuong", "$donGiaApDung"] } },
                    nhaKhoaInfo: { $first: "$nhaKhoaInfo" }
                }
            },
            {
                $project: {
                    _id: 0,
                    nhaKhoaId: "$_id",
                    tongSoLuong: 1,
                    tongDoanhSo: 1,
                    tenNhaKhoa: {
                        $let: {
                            vars: {
                                hvt: { $trim: { input: { $ifNull: ["$nhaKhoaInfo.hoVaTen", ""] } } },
                                tgd: { $trim: { input: { $ifNull: ["$nhaKhoaInfo.tenGiaoDich", ""] } } }
                            },
                            in: {
                                $cond: [
                                    { $ne: ["$$hvt", ""] }, "$$hvt",
                                    { $cond: [{ $ne: ["$$tgd", ""] }, "$$tgd", "Khách hàng đã xóa (Mồ côi)"] }
                                ]
                            }
                        }
                    }
                }
            },
            { $sort: { tongDoanhSo: -1 } }
        ]);

        res.status(200).json({ success: true, data: reportData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 5: Doanh số theo sản phẩm
// ─────────────────────────────────────────────────────────────────────────────
exports.getDoanhSoTheoSanPham = async (req, res) => {
    try {
        const { startDate, endDate, nhaKhoa } = req.query;
        const { start, end } = normalizeRange(startDate, endDate);

        const matchCondition = { ngayNhan: { $gte: start, $lte: end } };
        if (nhaKhoa) matchCondition.nhaKhoa = new mongoose.Types.ObjectId(nhaKhoa);

        const reportData = await DonHang.aggregate([
            { $match: matchCondition },
            { $unwind: "$danhSachSanPham" },
            { $match: { "danhSachSanPham.loaiDon": "Mới" } },
            ...buildGiaPipeline(),
            {
                $group: {
                    _id: "$danhSachSanPham.sanPham",
                    tongSoLuong: { $sum: "$danhSachSanPham.soLuong" },
                    tongDoanhSo: { $sum: { $multiply: ["$danhSachSanPham.soLuong", "$donGiaApDung"] } },
                    sanPhamInfo: { $first: "$sanPhamInfo" }
                }
            },
            {
                $project: {
                    _id: 0,
                    sanPhamId: "$_id",
                    tenSanPham: { $ifNull: ["$sanPhamInfo.tenSanPham", "Sản phẩm đã xóa"] },
                    tongSoLuong: 1,
                    tongDoanhSo: 1
                }
            },
            { $sort: { tongDoanhSo: -1 } }
        ]);

        res.status(200).json({ success: true, data: reportData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 6: Doanh số theo thời gian (Từng ngày)
// ─────────────────────────────────────────────────────────────────────────────
exports.getDoanhSoTheoThoiGian = async (req, res) => {
    try {
        const { startDate, endDate, nhaKhoa } = req.query;
        const { start, end } = normalizeRange(startDate, endDate);

        const matchCondition = { ngayNhan: { $gte: start, $lte: end } };
        if (nhaKhoa) matchCondition.nhaKhoa = new mongoose.Types.ObjectId(nhaKhoa);

        const reportData = await DonHang.aggregate([
            { $match: matchCondition },
            { $unwind: "$danhSachSanPham" },
            { $match: { "danhSachSanPham.loaiDon": "Mới" } },
            ...buildGiaPipeline(),
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$ngayNhan", timezone: "Asia/Ho_Chi_Minh" } },
                    tongDoanhSo: { $sum: { $multiply: ["$danhSachSanPham.soLuong", "$donGiaApDung"] } }
                }
            },
            {
                $project: {
                    _id: 0,
                    thoiGian: "$_id",
                    tongDoanhSo: 1
                }
            },
            { $sort: { thoiGian: 1 } }
        ]);

        res.status(200).json({ success: true, data: reportData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 7: Doanh thu tháng (Báo cáo công nợ)
// ─────────────────────────────────────────────────────────────────────────────
exports.getDoanhThuThang = async (req, res) => {
    try {
        const thang = parseInt(req.query.thang) || new Date().getMonth() + 1;
        const nam = parseInt(req.query.nam) || new Date().getFullYear();

        const startOfMonth = dayjs.tz(`${nam}-${String(thang).padStart(2, "0")}-01`, VN_TZ).startOf("month").toDate();
        const endOfMonth = dayjs(startOfMonth).tz(VN_TZ).endOf("month").toDate();

        const hdStats = await HoaDon.aggregate([
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

        const ptStats = await PhieuThu.aggregate([
            { $match: { nhaKhoa: { $ne: null }, trangThai: { $ne: "Đã hủy" } } },

            // 👉 THÊM BƯỚC NÀY ĐỂ XÁC ĐỊNH NGÀY DÙNG ĐỂ TÍNH DOANH THU
            {
                $addFields: {
                    ngayTinhDoanhThu: { $ifNull: ["$ngayGhiNhanDoanhThu", "$ngayThu"] }
                }
            },

            {
                $group: {
                    _id: "$nhaKhoa",
                    thanhToanTruoc: {
                        // 👉 CẬP NHẬT TRƯỜNG SO SÁNH
                        $sum: { $cond: [{ $lt: ["$ngayTinhDoanhThu", startOfMonth] }, "$soTienThu", 0] }
                    },
                    thanhToanTrong: {
                        $sum: {
                            $cond: [
                                // 👉 CẬP NHẬT TRƯỜNG SO SÁNH
                                { $and: [{ $gte: ["$ngayTinhDoanhThu", startOfMonth] }, { $lte: ["$ngayTinhDoanhThu", endOfMonth] }] },
                                "$soTienThu", 0
                            ]
                        }
                    }
                }
            }
        ]);

        const nhaKhoaList = await NhaKhoa.find({}, "tenGiaoDich hoVaTen ghiChuThang").lean();

        const hdMap = hdStats.reduce((m, x) => { m[x._id.toString()] = x; return m; }, {});
        const ptMap = ptStats.reduce((m, x) => { m[x._id.toString()] = x; return m; }, {});

        let tongNoDauKy = 0, tongPhatSinh = 0, tongThanhToan = 0, tongConNo = 0;
        const chiTiet = [];

        for (const nk of nhaKhoaList) {
            const id = nk._id.toString();
            const hd = hdMap[id] || { phatSinhTruoc: 0, phatSinhTrong: 0 };
            const pt = ptMap[id] || { thanhToanTruoc: 0, thanhToanTrong: 0 };

            const noDauKy = Math.round(hd.phatSinhTruoc - pt.thanhToanTruoc);
            const phatSinh = Math.round(hd.phatSinhTrong);
            const thanhToan = Math.round(pt.thanhToanTrong);
            const conNo = Math.round(noDauKy + phatSinh - thanhToan);

            if (noDauKy !== 0 || phatSinh !== 0 || thanhToan !== 0 || conNo !== 0) {
                tongNoDauKy += noDauKy;
                tongPhatSinh += phatSinh;
                tongThanhToan += thanhToan;
                tongConNo += conNo;

                const ghiChuEntry = (nk.ghiChuThang || []).find(g => g.thang === thang && g.nam === nam);

                chiTiet.push({
                    nhaKhoaId: id,
                    tenNhaKhoa: nk.tenGiaoDich || nk.hoVaTen || "—",
                    noDauKy, phatSinh, thanhToan, conNo,
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