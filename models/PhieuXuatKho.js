const mongoose = require('mongoose');

const phieuXuatKhoSchema = new mongoose.Schema({
    soPhieu: {
        type: String,
        unique: true,
        index: true
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
    boPhan: {
        type: String,
        required: true
    },
    nhanVien: {
        type: String,
        required: true
    },
    ngayTao: {
        type: Date,
        default: Date.now,
        required: true
    }
})

phieuXuatKhoSchema.pre("save", async function (next) {
    if (this.soPhieu) return;

    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `XUAT${yy}${mm}`;

    const lastPhieuXuat = await mongoose
        .model("PhieuXuatKho")
        .findOne({ soPhieu: { $regex: `^${prefix}` } })
        .sort({ soPhieu: -1 });

    let nextNumber = 1; // Bắt đầu từ 0001
    if (lastPhieuXuat?.soPhieu) {
        const lastNumber = parseInt(lastPhieuXuat.soPhieu.slice(-4), 10);
        if (Number.isFinite(lastNumber)) {
            nextNumber = lastNumber + 1;
        }
    }

    this.soPhieu = `${prefix}${String(nextNumber).padStart(4, "0")}`;
});

module.exports = mongoose.model("PhieuXuatKho", phieuXuatKhoSchema);