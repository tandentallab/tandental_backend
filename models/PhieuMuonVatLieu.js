const mongoose = require('mongoose');

const phieuMuonVatLieu = new mongoose.Schema({
    loai: {
        type: String,
        enum: ["Mượn", "Cho mượn"],
        default: "Mượn"
    },
    nhanVien: { type: String },
    doiTac: {
        ten: { type: String },
        diaChi: { type: String },
        soDienThoai: { type: String }
    },
    danhSachVatLieu: [
        {
            vatLieu: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "VatLieu"
            },
            soLuong: {
                type: Number,
                default: 1
            },
            moTa: {
                type: String
            }
        }
    ],
    ghiChu: {
        type: String
    },
    trangThaiNhan: {
        type: String,
        enum: ["Chưa nhận", "Đã nhận"],
        default: "Chưa nhận"
    },
    trangThaiTra: {
        type: String,
        enum: ["Chưa trả", "Đã trả"],
        default: "Chưa trả"
    },
    ngayTao: {
        type: Date,
        default: Date.now,
        required: true
    },
    ngayCapNhat: {
        type: Date
    },
})

module.exports = mongoose.model("PhieuMuonVatLieu", phieuMuonVatLieu);