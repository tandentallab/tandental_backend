const mongoose = require('mongoose');

const phieuNhapKhoSchema = new mongoose.Schema({
    soPhieu: {
        type: String,
        unique: true,
        index: true
    },
    nhaCungCap: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "NhaCungCap"
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
            donGia: {
                type: Number,
                default: 0
            },
            thanhTien: {
                type: Number,
                default: 0
            },
            moTa: {
                type: String
            }
        }
    ],
    ghiChu: {
        type: String
    },
    trangThaiNhap: {
        type: String,
        enum: ["Chưa nhận", "Đã nhận"],
        default: "Chưa nhận"
    },
    trangThaiThanhToan: {
        type: String,
        enum: ["Chưa thanh toán", "Đã thanh toán"],
        default: "Chưa thanh toán"
    },
    nguoiTao: {
        type: String,
        required: true
    },
    ngayTao: {
        type: Date,
        default: Date.now,
        required: true
    },
    ngayNhan: {
        type: Date
    },
})

phieuNhapKhoSchema.pre("save", async function (next) {
    if (this.soPhieu) return;

    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `NHAP${yy}${mm}`;

    const lastPhieuNhap = await mongoose
        .model("PhieuNhapKho")
        .findOne({ soPhieu: { $regex: `^${prefix}` } })
        .sort({ soPhieu: -1 });

    let nextNumber = 1; // Bắt đầu từ 0001
    if (lastPhieuNhap?.soPhieu) {
        const lastNumber = parseInt(lastPhieuNhap.soPhieu.slice(-4), 10);
        if (Number.isFinite(lastNumber)) {
            nextNumber = lastNumber + 1;
        }
    }

    this.soPhieu = `${prefix}${String(nextNumber).padStart(4, "0")}`;
});

module.exports = mongoose.model("PhieuNhapKho", phieuNhapKhoSchema);