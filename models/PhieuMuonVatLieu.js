const mongoose = require('mongoose');

const phieuMuonVatLieu = new mongoose.Schema({
    soPhieu: {
        type: String,
        unique: true,
        index: true
    },
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

phieuMuonVatLieu.pre("save", async function (next) {
    if (this.soPhieu) return;

    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `MUON${yy}${mm}`;

    const lastPhieuMuon = await mongoose
        .model("PhieuMuonVatLieu")
        .findOne({ soPhieu: { $regex: `^${prefix}` } })
        .sort({ soPhieu: -1 });

    let nextNumber = 1; // Bắt đầu từ 0001
    if (lastPhieuMuon?.soPhieu) {
        const lastNumber = parseInt(lastPhieuMuon.soPhieu.slice(-4), 10);
        if (Number.isFinite(lastNumber)) {
            nextNumber = lastNumber + 1;
        }
    }

    this.soPhieu = `${prefix}${String(nextNumber).padStart(4, "0")}`;
});

module.exports = mongoose.model("PhieuMuonVatLieu", phieuMuonVatLieu);