const dayjs = require("dayjs");
const DonHang = require("../models/DonHang");
const SanPham = require("../models/SanPham");

const getDateRange = (timeRange, customStart, customEnd) => {
    // Nếu người dùng chọn ngày cụ thể trên lịch
    if (timeRange === "custom" && customStart && customEnd) {
        return {
            startDate: dayjs(customStart).startOf("day").toDate(),
            endDate: dayjs(customEnd).endOf("day").toDate()
        };
    }

    const now = dayjs();
    let startDate;
    let endDate = now.endOf("day").toDate();

    switch (timeRange) {
        case "today": startDate = now.startOf("day").toDate(); break;
        case "yesterday":
            startDate = now.subtract(1, "day").startOf("day").toDate();
            endDate = now.subtract(1, "day").endOf("day").toDate();
            break;
        case "this_week": startDate = now.startOf("week").add(1, "day").toDate(); break;
        case "last_week":
            startDate = now.subtract(1, "week").startOf("week").add(1, "day").toDate();
            endDate = now.subtract(1, "week").endOf("week").add(1, "day").toDate();
            break;
        case "last_7_days": startDate = now.subtract(7, "day").startOf("day").toDate(); break;
        case "last_10_days": startDate = now.subtract(10, "day").startOf("day").toDate(); break;
        case "this_month": startDate = now.startOf("month").toDate(); break;
        case "last_month":
            startDate = now.subtract(1, "month").startOf("month").toDate();
            endDate = now.subtract(1, "month").endOf("month").toDate();
            break;
        case "last_30_days": startDate = now.subtract(30, "day").startOf("day").toDate(); break;
        default: startDate = now.startOf("month").toDate();
    }
    return { startDate, endDate };
};

exports.getTopProductsReport = async (req, res) => {
    try {
        const { timeRange, dateType = 'ngayNhan', customStart, customEnd } = req.query;
        const { startDate, endDate } = getDateRange(timeRange, customStart, customEnd);

        const matchField = dateType === 'henGiao' ? 'henGiao' : 'ngayNhan';

        const topProducts = await DonHang.aggregate([
            {
                $match: {
                    [matchField]: { $gte: startDate, $lte: endDate },
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

exports.getDetailedProductReport = async (req, res) => {
    try {
        const { timeRange, dateType = 'ngayNhan', customStart, customEnd } = req.query;
        const { startDate, endDate } = getDateRange(timeRange, customStart, customEnd);
        const matchField = dateType === 'henGiao' ? 'henGiao' : 'ngayNhan';

        const reportData = await DonHang.aggregate([
            { $match: { [matchField]: { $gte: startDate, $lte: endDate } } },
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
                // Nhóm theo 3 cấp: loaiSanPham, nhomSanPham, tenSanPham
                $group: {
                    _id: {
                        loaiSP: "$productInfo.loaiSanPham",
                        nhomSP: "$productInfo.nhomSanPham",
                        tenSP: "$productInfo.tenSanPham"
                    },
                    // Lọc theo loaiDon từ Model Đơn hàng
                    moi: { $sum: { $cond: [{ $eq: ["$danhSachSanPham.loaiDon", "Mới"] }, "$danhSachSanPham.soLuong", 0] } },
                    sua: { $sum: { $cond: [{ $eq: ["$danhSachSanPham.loaiDon", "Sửa"] }, "$danhSachSanPham.soLuong", 0] } },
                    baoHanh: { $sum: { $cond: [{ $eq: ["$danhSachSanPham.loaiDon", "Bảo hành"] }, "$danhSachSanPham.soLuong", 0] } },
                    lamLai: { $sum: { $cond: [{ $eq: ["$danhSachSanPham.loaiDon", "Làm lại"] }, "$danhSachSanPham.soLuong", 0] } },
                    tong: { $sum: "$danhSachSanPham.soLuong" }
                }
            },
            {
                // Gom cấp 2: Theo Nhóm Sản Phẩm
                $group: {
                    _id: { loaiSP: "$_id.loaiSP", nhomSP: "$_id.nhomSP" },
                    products: {
                        $push: {
                            ten: "$_id.tenSP",
                            moi: "$moi", sua: "$sua", baoHanh: "$baoHanh", lamLai: "$lamLai", tong: "$tong"
                        }
                    },
                    n_moi: { $sum: "$moi" }, n_sua: { $sum: "$sua" }, n_bh: { $sum: "$baoHanh" }, n_ll: { $sum: "$lamLai" }, n_tong: { $sum: "$tong" }
                }
            },
            {
                // Gom cấp 3: Theo Loại Sản Phẩm
                $group: {
                    _id: "$_id.loaiSP",
                    groups: {
                        $push: {
                            tenNhom: "$_id.nhomSP",
                            products: "$products",
                            moi: "$n_moi", sua: "$n_sua", baoHanh: "$n_bh", lamLai: "$n_ll", tong: "$n_tong"
                        }
                    },
                    t_moi: { $sum: "$n_moi" }, t_sua: { $sum: "$n_sua" }, t_bh: { $sum: "$n_bh" }, t_ll: { $sum: "$n_ll" }, t_tong: { $sum: "$n_tong" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({ success: true, data: reportData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};