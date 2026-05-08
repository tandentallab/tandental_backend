const mongoose = require("mongoose");

const donHangSchema = new mongoose.Schema(
    {
        nhaKhoa: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "NhaKhoa",
            required: [true, "Vui lòng chọn Nha khoa"],
        },
        bacSi: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "NguoiLienHe",
            required: [true, "Vui lòng chọn Bác sĩ"],
        },
        benhNhan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BenhNhan",
            required: [true, "Vui lòng chọn Bệnh nhân"],
        },

        // Mảng nhúng Danh sách sản phẩm
        danhSachSanPham: [
            {
                loaiDon: {
                    type: String,
                    enum: ["Mới", "Hàng sửa", "Hàng làm lại", "Hàng bảo hành"],
                    required: true,
                    default: "Mới",
                },
                donHangCu: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "DonHang",
                    default: null, // Chỉ có giá trị nếu loaiDon khác "Mới"
                },
                sanPham: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "SanPham",
                    required: true,
                },
                viTri: [
                    {
                        kieu: {
                            type: String,
                            enum: ["Rời", "Cầu"],
                            required: true,
                        },
                        soRang: [{ type: Number }], // VD: [11] (Rời) hoặc [12, 13, 14] (Cầu)
                    },
                ],
                soLuong: {
                    type: Number,
                    default: 1,
                    min: 1,
                },
                mau: String,
                ghiChu: String,
            },
        ],

        // Mảng nhúng Danh sách phụ kiện
        danhSachPhuKien: [
            {
                tenPhuKien: {
                    type: String,
                    enum: [
                        "Analog", "Cây so màu", "Dấu sơ khởi", "Giá khớp", "Gối sáp",
                        "Hàm khung", "Hàm tháo lắp", "Hàm đối diện", "Khay lấy dấu",
                        "Răng cũ", "Sáp cắn", "Trụ abutment"
                    ],
                    required: true,
                },
                soLuong: {
                    type: Number,
                    required: true,
                    default: 1,
                    min: 1,
                },
                soHuu: {
                    type: String,
                    enum: ["Lab", "Nha khoa"],
                    required: true,
                },
            },
        ],

        // Nhóm thời gian
        ngayNhan: { type: Date, required: true },
        yeuCauHoanThanh: { type: Date, required: true },
        henGiao: { type: Date, required: true },

        // Nhóm ghi chú chung
        chiDinhBacSi: String,
        ghiChuChung: String,
        ghiChuTaiChinh: String,

        // Trạng thái đơn hàng (để quản lý luồng về sau)
        trangThai: {
            type: String,
            enum: ["Chờ xử lý", "Đang sản xuất", "Hoàn thành", "Đã giao"],
            default: "Chờ xử lý",
        },
        daXuatHoaDon: {
            type: Boolean,
            default: false,
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("DonHang", donHangSchema);