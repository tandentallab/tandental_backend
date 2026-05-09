const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const DonHang = require('../models/DonHang');
const PhieuThu = require('../models/PhieuThu');
const VN_TZ = "Asia/Ho_Chi_Minh"; // UTC+7

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Chuẩn hóa khoảng ngày theo múi giờ Việt Nam
// ─────────────────────────────────────────────────────────────────────────────
const normalizeRange = (startDate, endDate) => {
    if (!startDate || !endDate) {
        const now = dayjs().tz(VN_TZ);
        return {
            start: now.subtract(7, "day").startOf("day").toDate(),
            end: now.endOf("day").toDate(),
        };
    }
    return {
        start: dayjs.tz(startDate, VN_TZ).startOf("day").toDate(),
        end: dayjs.tz(endDate, VN_TZ).endOf("day").toDate(),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT NGÀY: Thêm tham số dateField để dùng chung cho cả ngayNhan và ngayThu
// ─────────────────────────────────────────────────────────────────────────────
const buildDateGroup = (groupBy, dateField) => {
    if (groupBy === "week") {
        return {
            sortKey: { $dateToString: { format: "%G-W%V", date: dateField, timezone: VN_TZ } },
            displayDate: { $dateToString: { format: "Tuần %V, %G", date: dateField, timezone: VN_TZ } },
        };
    }
    return {
        sortKey: { $dateToString: { format: "%Y-%m-%d", date: dateField, timezone: VN_TZ } },
        displayDate: { $dateToString: { format: "%d/%m", date: dateField, timezone: VN_TZ } },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// API: Lấy dữ liệu cho 1 chart
// ─────────────────────────────────────────────────────────────────────────────
exports.getChartStats = async (req, res) => {
    try {
        const { chartType, startDate, endDate, groupBy = "day" } = req.query;
        const { start, end } = normalizeRange(startDate, endDate);

        // Xác định trường ngày cần filter và group tùy theo Chart
        const isThu = chartType === "chart3";
        const filterField = isThu ? "ngayThu" : "ngayNhan";
        const groupField = isThu ? "$ngayThu" : "$ngayNhan";

        const { sortKey, displayDate } = buildDateGroup(groupBy, groupField);
        const matchQuery = { [filterField]: { $gte: start, $lte: end } };

        let resultData = [];

        if (chartType === "chart1") {
            // ... (Giữ nguyên logic chart1 của bạn) ...
            resultData = await DonHang.aggregate([
                { $match: matchQuery },
                { $unwind: "$danhSachSanPham" },
                {
                    $group: {
                        _id: { sortKey, displayDate, loaiDon: "$danhSachSanPham.loaiDon" },
                        totalSoLuong: { $sum: "$danhSachSanPham.soLuong" },
                    },
                },
                {
                    $group: {
                        _id: { sortKey: "$_id.sortKey", displayDate: "$_id.displayDate" },
                        chiTiet: { $push: { k: "$_id.loaiDon", v: "$totalSoLuong" } },
                    },
                },
                { $sort: { "_id.sortKey": 1 } },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [{ date: "$_id.displayDate" }, { $arrayToObject: "$chiTiet" }],
                        },
                    },
                },
            ]);

        } else if (chartType === "chart2") {
            // ... (Giữ nguyên logic chart2 của bạn) ...
            resultData = await DonHang.aggregate([
                { $match: matchQuery },
                {
                    $addFields: {
                        soSanPhamKhongPhaiMoi: {
                            $size: {
                                $filter: {
                                    input: "$danhSachSanPham", as: "sp",
                                    cond: { $ne: ["$$sp.loaiDon", "Mới"] },
                                },
                            },
                        },
                    },
                },
                {
                    $addFields: {
                        loaiDonHang: {
                            $cond: [{ $gt: ["$soSanPhamKhongPhaiMoi", 0] }, "Khách gửi hàng", "Đơn hàng mới"],
                        },
                    },
                },
                {
                    $group: {
                        _id: { sortKey, displayDate, loai: "$loaiDonHang" },
                        totalOrders: { $sum: 1 },
                    },
                },
                {
                    $group: {
                        _id: { sortKey: "$_id.sortKey", displayDate: "$_id.displayDate" },
                        chiTiet: { $push: { k: "$_id.loai", v: "$totalOrders" } },
                    },
                },
                { $sort: { "_id.sortKey": 1 } },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [{ date: "$_id.displayDate" }, { $arrayToObject: "$chiTiet" }],
                        },
                    },
                },
            ]);

        } else if (chartType === "chart3") {
            // ─────────────────────────────────────────────────────────────────
            // CHART 3: DOANH SỐ THỰC THU (Tính theo Phiếu Thu)
            // ─────────────────────────────────────────────────────────────────
            resultData = await PhieuThu.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: { sortKey, displayDate },
                        "Thực thu": { $sum: "$soTienThu" } // Cộng dồn tiền thu
                    }
                },
                { $sort: { "_id.sortKey": 1 } },
                {
                    $project: {
                        _id: 0,
                        date: "$_id.displayDate",
                        "Thực thu": 1
                    }
                }
            ]);
        }

        return res.status(200).json({ success: true, data: resultData });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};