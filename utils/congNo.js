const mongoose = require("mongoose");
const HoaDon = require("../models/HoaDon");

const getCongNoNhaKhoa = async (nhaKhoaId) => {
    const result = await HoaDon.aggregate([
        {
            $match: {
                nhaKhoa: new mongoose.Types.ObjectId(nhaKhoaId),
                conLai: { $gt: 0 },
                // 🔥 THÊM DÒNG NÀY: Loại bỏ các hóa đơn đang ở trạng thái nháp
                trangThai: { $ne: "Lưu tạm" }
            }
        },
        {
            $group: {
                _id: null,
                tongCongNo: { $sum: "$conLai" }
            }
        }
    ]);

    return result[0]?.tongCongNo || 0;
};

// Lấy công nợ của tất cả nha khoa, trả về mảng { nhaKhoaId, tongCongNo }
const getCongNoTatCaNhaKhoa = async () => {
    const result = await HoaDon.aggregate([
        {
            $match: {
                conLai: { $gt: 0 },
            }
        },
        {
            $group: {
                _id: "$nhaKhoa",
                tongCongNo: { $sum: "$conLai" }
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
        {
            $unwind: {
                path: "$nhaKhoaInfo",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                _id: 0,
                nhaKhoaId: "$_id",
                tenNhaKhoa: "$nhaKhoaInfo.ten",
                tongCongNo: 1
            }
        },
        {
            $sort: { tongCongNo: -1 }
        }
    ]);

    return result;
};

module.exports = {
    getCongNoNhaKhoa,
    getCongNoTatCaNhaKhoa
};