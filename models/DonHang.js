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
        maDonHang: {
            type: String,
            unique: true,
            index: true,
            trim: true,
            sparse: true,
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
                // 🔥 THÊM TRƯỜNG NÀY ĐỂ CHỐT CỨNG GIÁ TẠI THỜI ĐIỂM TẠO ĐƠN
                donGia: {
                    type: Number,
                    default: 0,
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
                yeuCauThu: [
                    {
                        congDoan: { type: String },
                        ngayTao: { type: Date, default: Date.now },
                    },
                ],
                trangThaiCongDoan: [
                    {
                        thuTu: { type: Number, required: true },
                        trangThai: {
                            type: String,
                            enum: ["Chưa sẵn sàng", "Chờ sản xuất"],
                            default: "Chưa sẵn sàng",
                        },
                    },
                ],
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
        ghiChuSanXuat: String,

        // Nhật ký chỉnh sửa
        nhatKyChinhSua: [
            {
                nguoiThuc: { type: String, default: "Điều Phối" },
                hanhDong: { type: String, required: true },
                thoiGian: { type: Date, default: Date.now },
            },
        ],

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

// Thêm dòng này để tăng tốc độ truy vấn theo ngày tháng và trạng thái
donHangSchema.index({ createdAt: -1, trangThai: 1 });

module.exports = mongoose.model("DonHang", donHangSchema);