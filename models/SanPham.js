const mongoose = require("mongoose");

const sanPhamSchema = new mongoose.Schema(
    {
        tenSanPham: {
            type: String,
            required: [true, "Vui lòng nhập tên sản phẩm"],
            trim: true,
        },
        donGiaChung: {
            type: Number,
            required: [true, "Vui lòng nhập đơn giá chung"],
            min: [0, "Đơn giá chung không được nhỏ hơn 0"],
        },
        donGiaRieng: {
            type: Number,
            default: null,
            min: [0, "Đơn giá riêng không được nhỏ hơn 0"],
        },
        loaiTinh: {
            type: String,
            enum: {
                values: ["Răng", "Răng (không đếm)", "Bán hàm", "Hàm", "Khác"],
                message: "{VALUE} không phải là loại tính hợp lệ",
            },
            required: [true, "Vui lòng chọn loại tính"],
        },
        loaiSanPham: {
            type: String,
            enum: {
                values: ["Cố định", "Miễn phí", "Tháo lắp"],
                message: "{VALUE} không phải là loại sản phẩm hợp lệ",
            },
            required: [true, "Vui lòng chọn loại sản phẩm"],
        },
        coMauRang: {
            type: Boolean,
            default: false,
        },
        nhomSanPham: {
            type: String,
            enum: {
                values: [
                    "Dịch vụ miễn phí",
                    "Gia Công Sườn",
                    "Report Hợp Kim",
                    "Report Toàn Sứ",
                    "Tháo Lắp",
                ],
                message: "{VALUE} không thuộc nhóm sản phẩm hợp lệ",
            },
            required: [true, "Vui lòng chọn nhóm sản phẩm"],
        },
        // 👉 THÊM TRƯỜNG THỜI GIAN BẢO HÀNH MẶC ĐỊNH VÀO ĐÂY
        baoHanhMacDinh: {
            type: Number,
            min: 0,
            default: 0,
        },
        moTa: {
            type: String,
            trim: true,
            default: "",
        },
        loai: {
            type: String,
            enum: {
                values: ["Sản xuất", "Dịch vụ"],
                message: "{VALUE} không phải là loại hợp lệ",
            },
            required: [true, "Vui lòng chọn loại (Sản xuất hoặc Dịch vụ)"],
        },
        quyTrinh: [{
            tenCongDoan: String,
            thuTu: Number
        }],
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("SanPham", sanPhamSchema);