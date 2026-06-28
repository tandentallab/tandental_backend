const mongoose = require('mongoose');

const chiPhiSchema = new mongoose.Schema({
    tenChiPhi: {
        type: String,
        required: true,
        trim: true
    },
    loaiChiPhi: {
        type: String,
        required: true
    },
    gia: {
        type: Number,
        required: true,
        min: 0
    },
    ghiChu: {
        type: String,
        trim: true
    },
    ngayTao: {
        type: Date,
        default: Date.now // Lưu lại ngày tạo để sau này làm báo cáo
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ChiPhi', chiPhiSchema);