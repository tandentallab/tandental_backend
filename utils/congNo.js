const mongoose = require("mongoose");
const HoaDon = require("../models/HoaDon");

const getCongNoNhaKhoa = async (nhaKhoaId) => {
    const result = await HoaDon.aggregate([
        {
            $match: {
                nhaKhoa: new mongoose.Types.ObjectId(nhaKhoaId),
                conLai: { $gt: 0 }
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

module.exports = {
    getCongNoNhaKhoa
};