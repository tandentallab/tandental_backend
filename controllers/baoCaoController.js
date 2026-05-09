const dayjs = require("dayjs");
const DonHang = require("../models/DonHang");
const SanPham = require("../models/SanPham");

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Chuẩn hóa khoảng ngày
//   • Luôn nhận 2 tham số rõ ràng từ frontend (YYYY-MM-DD)
//   • startDate → 00:00:00.000   (đầu ngày)
//   • endDate   → 23:59:59.999   (cuối ngày)
//   Loại bỏ hoàn toàn logic "tính ngày" phía backend → frontend là SSOT
// ─────────────────────────────────────────────────────────────────────────────
const normalizeRange = (startDate, endDate) => {
    if (!startDate || !endDate) {
        // Fallback an toàn: tháng hiện tại
        const now = dayjs();
        return {
            start: now.startOf("month").toDate(),
            end: now.endOf("day").toDate(),
        };
    }
    return {
        start: dayjs(startDate).startOf("day").toDate(),   // 00:00:00.000
        end: dayjs(endDate).endOf("day").toDate(),          // 23:59:59.999
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// API 1: Top 10 sản phẩm (dùng cho Biểu đồ)
// ─────────────────────────────────────────────────────────────────────────────
exports.getTopProductsReport = async (req, res) => {
    try {
        const { startDate, endDate, dateType = "ngayNhan" } = req.query;
        const { start, end } = normalizeRange(startDate, endDate);
        const matchField = dateType === "henGiao" ? "henGiao" : "ngayNhan";

        const topProducts = await DonHang.aggregate([
            {
                $match: {
                    [matchField]: { $gte: start, $lte: end },
                },
            },
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
            {
                $project: {
                    _id: 0,
                    name: "$productInfo.tenSanPham",
                    quantity: 1,
                },
            },
        ]);

        res.status(200).json({ success: true, data: topProducts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 2: Báo cáo chi tiết 3 tầng (dùng cho Bảng)
// ─────────────────────────────────────────────────────────────────────────────
exports.getDetailedProductReport = async (req, res) => {
    try {
        const { startDate, endDate, dateType = "ngayNhan" } = req.query;
        const { start, end } = normalizeRange(startDate, endDate);
        const matchField = dateType === "henGiao" ? "henGiao" : "ngayNhan";

        const reportData = await DonHang.aggregate([
            {
                $match: {
                    [matchField]: { $gte: start, $lte: end },
                },
            },
            { $unwind: "$danhSachSanPham" },
            { $addFields: { productObjectId: { $toObjectId: "$danhSachSanPham.sanPham" } } },
            {
                $lookup: {
                    from: "sanphams",
                    localField: "productObjectId",
                    foreignField: "_id",
                    as: "productInfo",
                },
            },
            { $unwind: "$productInfo" },
            {
                // Tầng 1: Nhóm theo (loaiSanPham, nhomSanPham, tenSanPham)
                $group: {
                    _id: {
                        loaiSP: "$productInfo.loaiSanPham",
                        nhomSP: "$productInfo.nhomSanPham",
                        tenSP: "$productInfo.tenSanPham",
                    },
                    moi: { $sum: { $cond: [{ $eq: ["$danhSachSanPham.loaiDon", "Mới"] }, "$danhSachSanPham.soLuong", 0] } },
                    sua: { $sum: { $cond: [{ $eq: ["$danhSachSanPham.loaiDon", "Sửa"] }, "$danhSachSanPham.soLuong", 0] } },
                    baoHanh: { $sum: { $cond: [{ $eq: ["$danhSachSanPham.loaiDon", "Bảo hành"] }, "$danhSachSanPham.soLuong", 0] } },
                    lamLai: { $sum: { $cond: [{ $eq: ["$danhSachSanPham.loaiDon", "Làm lại"] }, "$danhSachSanPham.soLuong", 0] } },
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