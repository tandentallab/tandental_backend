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
// FORMAT NGÀY: Định dạng trục X (Ngày/Tuần) có kèm Timezone VN
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
// API: GET CHART STATS
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
            // ─────────────────────────────────────────────────────────────────
            // CHART 1: HÀNG NHẬN THEO LOẠI SẢN PHẨM
            // ─────────────────────────────────────────────────────────────────
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
            // ─────────────────────────────────────────────────────────────────
            // CHART 2: TÌNH HÌNH NHẬN HÀNG (ĐƠN)
            // ─────────────────────────────────────────────────────────────────
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
            const diffMs = end.getTime() - start.getTime() + 1;
            const prevStart = new Date(start.getTime() - diffMs);
            const prevEnd = new Date(end.getTime() - diffMs);

            const currentPeriod = await PhieuThu.aggregate([
                { $match: { ngayThu: { $gte: start, $lte: end } } },
                { $group: { _id: { sortKey, displayDate }, total: { $sum: "$duocKhauTru" } } }, // ✅
                { $sort: { "_id.sortKey": 1 } }
            ]);

            const previousPeriod = await PhieuThu.aggregate([
                { $match: { ngayThu: { $gte: prevStart, $lte: prevEnd } } },
                { $group: { _id: { sortKey, displayDate }, total: { $sum: "$duocKhauTru" } } }, // ✅
                { $sort: { "_id.sortKey": 1 } }
            ]);

            if (groupBy === 'day') {
                let currDate = dayjs(start);
                const endDay = dayjs(end);

                while (currDate.isBefore(endDay) || currDate.isSame(endDay, 'day')) {
                    const currentSortKey = currDate.format('YYYY-MM-DD');
                    const currentDisplay = currDate.format('DD/MM');

                    // Tính ngày tương ứng của kì trước
                    const prevDateObj = currDate.subtract(diffMs, 'millisecond');

                    const currentVal = currentPeriod.find(p => p._id.sortKey === currentSortKey)?.total || 0;
                    const prevVal = previousPeriod.find(p => p._id.sortKey === prevDateObj.format('YYYY-MM-DD'))?.total || 0;

                    resultData.push({
                        date: currentDisplay,
                        prevDate: prevDateObj.format('DD/MM'), // 👉 Gửi thêm ngày kì trước về
                        "Kì này": currentVal,
                        "Kì trước": prevVal
                    });

                    currDate = currDate.add(1, 'day');
                }
            } else {
                const maxLength = Math.max(currentPeriod.length, previousPeriod.length);
                for (let i = 0; i < maxLength; i++) {
                    const labelDate = currentPeriod[i]?._id.displayDate || `Điểm ${i + 1}`;
                    const prevLabelDate = previousPeriod[i]?._id.displayDate || "N/A";

                    resultData.push({
                        date: labelDate,
                        prevDate: prevLabelDate, // 👉 Gửi thêm tuần/tháng kì trước về
                        "Kì này": currentPeriod[i]?.total || 0,
                        "Kì trước": previousPeriod[i]?.total || 0
                    });
                }
            }
        } else if (chartType === "chart4") {
            const HoaDon = require('../models/HoaDon');
            const { sortKey, displayDate } = buildDateGroup(groupBy, "$ngayXuatHoaDon");

            resultData = await HoaDon.aggregate([
                { $match: { ngayXuatHoaDon: { $gte: start, $lte: end } } },
                {
                    $group: {
                        _id: { sortKey, displayDate },
                        tongGhiNhan: { $sum: "$thanhTien" },
                        tongDaThu: { $sum: "$daThanhToan" },
                        tongConLai: { $sum: "$conLai" },
                    }
                },
                { $sort: { "_id.sortKey": 1 } },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                { date: "$_id.displayDate" },
                                { "Doanh thu": "$tongGhiNhan" },
                                { "Đã thu": "$tongDaThu" },
                                { "Còn nợ": "$tongConLai" },
                            ]
                        }
                    }
                }
            ]);
        }

        return res.status(200).json({ success: true, data: resultData });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};