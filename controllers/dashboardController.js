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
            // CHART 1: THỐNG KÊ SỐ LƯỢNG THEO LOẠI ĐƠN (Chỉ lấy Report Toàn Sứ & Report Hợp Kim)
            resultData = await DonHang.aggregate([
                { $match: matchQuery },
                // 1. Tách mảng danhSachSanPham ra thành từng object riêng biệt
                { $unwind: "$danhSachSanPham" },

                // 2. Lookup sang collection sanphams để lấy thông tin chi tiết của sản phẩm
                {
                    $lookup: {
                        from: "sanphams",
                        localField: "danhSachSanPham.sanPham", // Trỏ đúng vào trường sanPham (chứa ObjectId) trong schema DonHang
                        foreignField: "_id",
                        as: "thongTinSP"
                    }
                },

                // 3. Unwind kết quả lookup
                { $unwind: "$thongTinSP" },

                // 4. Lọc chỉ lấy sản phẩm thuộc 2 nhóm yêu cầu
                {
                    $match: {
                        "thongTinSP.nhomSanPham": {
                            $in: ["Report Toàn Sứ", "Report Hợp Kim"]
                        }
                    }
                },

                // 5. Gom nhóm và tính tổng số lượng (Giữ nguyên logic của bạn)
                {
                    $group: {
                        _id: {
                            sortKey,
                            displayDate,
                            loaiDon: {
                                $switch: {
                                    branches: [
                                        {
                                            case: { $regexMatch: { input: { $ifNull: ["$danhSachSanPham.loaiDon", ""] }, regex: "sửa|sửa", options: "i" } },
                                            then: "Hàng sửa"
                                        },
                                        {
                                            case: { $regexMatch: { input: { $ifNull: ["$danhSachSanPham.loaiDon", ""] }, regex: "bảo hành|bảo hành", options: "i" } },
                                            then: "Hàng bảo hành"
                                        },
                                        {
                                            case: { $regexMatch: { input: { $ifNull: ["$danhSachSanPham.loaiDon", ""] }, regex: "làm lại|làm lại", options: "i" } },
                                            then: "Hàng làm lại"
                                        },
                                    ],
                                    default: "Mới"
                                }
                            }
                        },
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Lấy snapshot dữ liệu realtime hôm nay
// ─────────────────────────────────────────────────────────────────────────────
const BangGia = require('../models/BangGia');

const fetchRealtimeSnapshot = async () => {
    const now = dayjs().tz(VN_TZ);
    const todayStart = now.startOf("day").toDate();
    const todayEnd = now.endOf("day").toDate();

    const ALL_LOAI_DON = ["Mới", "Hàng sửa", "Hàng làm lại", "Hàng bảo hành"];
    const ALL_NHOM = ["Report Hợp Kim", "Report Toàn Sứ"];

    // ── 1. Số đơn hàng hôm nay theo loaiDon ────────────────────────────────
    // "Mới"         = đơn mà TẤT CẢ item đều là "Mới" (nhất quán với chart2)
    // Còn lại       = đơn có ÍT NHẤT 1 item thuộc loại đó
    const donHangRaw = await DonHang.aggregate([
        { $match: { ngayNhan: { $gte: todayStart, $lte: todayEnd } } },
        {
            $addFields: {
                loaiDonSet: { $setUnion: "$danhSachSanPham.loaiDon" },
                soSPKhongMoi: {
                    $size: {
                        $filter: {
                            input: "$danhSachSanPham",
                            as: "sp",
                            cond: { $ne: ["$$sp.loaiDon", "Mới"] },
                        },
                    },
                },
            },
        },
        {
            $facet: {
                donMoi: [{ $match: { soSPKhongMoi: 0 } }, { $count: "total" }],
                hangSua: [{ $match: { loaiDonSet: "Hàng sửa" } }, { $count: "total" }],
                hangLamLai: [{ $match: { loaiDonSet: "Hàng làm lại" } }, { $count: "total" }],
                hangBaoHanh: [{ $match: { loaiDonSet: "Hàng bảo hành" } }, { $count: "total" }],
            },
        },
    ]);

    const facet = donHangRaw[0] ?? {};
    const donHangHomNay = {
        "Mới": facet.donMoi?.[0]?.total ?? 0,
        "Hàng sửa": facet.hangSua?.[0]?.total ?? 0,
        "Hàng làm lại": facet.hangLamLai?.[0]?.total ?? 0,
        "Hàng bảo hành": facet.hangBaoHanh?.[0]?.total ?? 0,
    };

    // ── 2. Số lượng răng hôm nay theo nhóm SP + loaiDon ─────────────────────
    const rangRaw = await DonHang.aggregate([
        { $match: { ngayNhan: { $gte: todayStart, $lte: todayEnd } } },
        { $unwind: "$danhSachSanPham" },
        {
            $lookup: {
                from: "sanphams",
                localField: "danhSachSanPham.sanPham",
                foreignField: "_id",
                as: "spInfo",
            },
        },
        { $unwind: "$spInfo" },
        { $match: { "spInfo.nhomSanPham": { $in: ALL_NHOM } } },
        {
            $group: {
                _id: {
                    nhomSanPham: "$spInfo.nhomSanPham",
                    loaiDon: "$danhSachSanPham.loaiDon",
                },
                soLuong: { $sum: "$danhSachSanPham.soLuong" },
            },
        },
    ]);

    const rangHomNay = ALL_NHOM.reduce((acc, nhom) => {
        acc[nhom] = ALL_LOAI_DON.reduce((inner, loai) => {
            inner[loai] =
                rangRaw.find(
                    (r) => r._id.nhomSanPham === nhom && r._id.loaiDon === loai
                )?.soLuong ?? 0;
            return inner;
        }, {});
        return acc;
    }, {});

    // ── 3. Doanh thu dự kiến hôm nay (chỉ tính đơn Mới) ────────────────────
    // Lấy đơn giá từ BangGia (riêng) nếu có, ngược lại dùng donGiaChung của SanPham
    const doanhThuRaw = await DonHang.aggregate([
        { $match: { ngayNhan: { $gte: todayStart, $lte: todayEnd } } },
        { $unwind: "$danhSachSanPham" },
        { $match: { "danhSachSanPham.loaiDon": "Mới" } },
        {
            $lookup: {
                from: "sanphams",
                localField: "danhSachSanPham.sanPham",
                foreignField: "_id",
                as: "spInfo",
            },
        },
        { $unwind: "$spInfo" },
        { $match: { "spInfo.nhomSanPham": { $in: ["Report Hợp Kim", "Report Toàn Sứ"] } } },
        {
            $lookup: {
                from: "banggias",
                let: { nhaKhoaId: "$nhaKhoa", sanPhamId: "$danhSachSanPham.sanPham" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$nhaKhoaId", "$$nhaKhoaId"] },
                                    { $eq: ["$sanPhamId", "$$sanPhamId"] },
                                ],
                            },
                        },
                    },
                    { $limit: 1 },
                ],
                as: "bangGiaInfo",
            },
        },
        {
            $addFields: {
                donGiaThucTe: {
                    $cond: [
                        { $gt: [{ $size: "$bangGiaInfo" }, 0] },
                        { $arrayElemAt: ["$bangGiaInfo.donGia", 0] },
                        "$spInfo.donGiaChung",
                    ],
                },
            },
        },
        {
            $group: {
                _id: null,
                doanhThuDuKien: {
                    $sum: { $multiply: ["$danhSachSanPham.soLuong", "$donGiaThucTe"] },
                },
            },
        },
    ]);

    const doanhThuDuKien = doanhThuRaw[0]?.doanhThuDuKien ?? 0;

    return {
        ngay: now.format("DD/MM/YYYY"),
        donHangHomNay,
        rangHomNay,
        doanhThuDuKien,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// API: GET REALTIME STATS — SSE (Server-Sent Events)
// GET /api/dashboard/realtime-stats
// Client nhận push mỗi 30s, không cần reload
// ─────────────────────────────────────────────────────────────────────────────
exports.getRealtimeStats = async (req, res) => {
    try {
        const snapshot = await fetchRealtimeSnapshot();
        return res.status(200).json({ success: true, data: snapshot });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDonHangByMonth = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { start, end } = normalizeRange(startDate, endDate);

        const result = await DonHang.aggregate([
            {
                $match: {
                    ngayNhan: {
                        $gte: start,
                        $lte: end,
                    },
                },
            },
            {
                $addFields: {
                    loaiDonSet: {
                        $setUnion: ["$danhSachSanPham.loaiDon"],
                    },
                    soSPKhongMoi: {
                        $size: {
                            $filter: {
                                input: "$danhSachSanPham",
                                as: "sp",
                                cond: {
                                    $ne: ["$$sp.loaiDon", "Mới"],
                                },
                            },
                        },
                    },
                },
            },
            {
                $facet: {
                    donMoi: [
                        { $match: { soSPKhongMoi: 0 } },
                        { $count: "total" },
                    ],
                    hangSua: [
                        { $match: { loaiDonSet: "Hàng sửa" } },
                        { $count: "total" },
                    ],
                    hangLamLai: [
                        { $match: { loaiDonSet: "Hàng làm lại" } },
                        { $count: "total" },
                    ],
                    hangBaoHanh: [
                        { $match: { loaiDonSet: "Hàng bảo hành" } },
                        { $count: "total" },
                    ],
                },
            },
        ]);

        const facet = result[0] ?? {};

        return res.status(200).json({
            success: true,
            data: {
                donHang: {
                    "Mới": facet.donMoi?.[0]?.total ?? 0,
                    "Hàng sửa": facet.hangSua?.[0]?.total ?? 0,
                    "Hàng làm lại": facet.hangLamLai?.[0]?.total ?? 0,
                    "Hàng bảo hành": facet.hangBaoHanh?.[0]?.total ?? 0,
                },
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};