const ChiPhi = require('../models/ChiPhi'); // Đường dẫn có thể thay đổi tùy cấu trúc thư mục của bạn
const BangLuong = require('../models/BangLuong'); // Import model Bảng Lương
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Ho_Chi_Minh");
// 1. Tạo chi phí mới
exports.taoChiPhi = async (req, res) => {
    try {
        const { tenChiPhi, loaiChiPhi, gia, ghiChu } = req.body;

        // Kiểm tra đầu vào cơ bản
        if (!tenChiPhi || !loaiChiPhi || gia === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ Tên, Loại chi phí và Giá!'
            });
        }

        const chiPhiMoi = new ChiPhi({
            tenChiPhi,
            loaiChiPhi,
            gia,
            ghiChu
        });

        const daLuu = await chiPhiMoi.save();

        res.status(201).json({
            success: true,
            message: 'Tạo chi phí thành công',
            data: daLuu
        });

    } catch (error) {
        console.error('Lỗi khi tạo chi phí:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo chi phí',
            error: error.message
        });
    }
};

// 2. Lấy danh sách tất cả chi phí
exports.layDanhSachChiPhi = async (req, res) => {
    try {
        // Lấy danh sách và sắp xếp theo ngày tạo mới nhất (giảm dần)
        const danhSachChiPhi = await ChiPhi.find().sort({ ngayTao: -1 });

        res.status(200).json({
            success: true,
            data: danhSachChiPhi
        });

    } catch (error) {
        console.error('Lỗi khi lấy danh sách chi phí:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách chi phí',
            error: error.message
        });
    }
};

// 3. Xóa chi phí (Option: Dành cho trường hợp nhập sai)
exports.xoaChiPhi = async (req, res) => {
    try {
        const { id } = req.params;
        const chiPhiDaXoa = await ChiPhi.findByIdAndDelete(id);

        if (!chiPhiDaXoa) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi phí cần xóa'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Đã xóa chi phí thành công'
        });

    } catch (error) {
        console.error('Lỗi khi xóa chi phí:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi xóa chi phí',
            error: error.message
        });
    }
};

exports.layDanhSachChiPhi = async (req, res) => {
    try {
        // 1. Lấy tháng/năm từ query, mặc định là tháng hiện tại theo giờ VN
        const now = dayjs().tz("Asia/Ho_Chi_Minh");
        const thang = req.query.thang ? parseInt(req.query.thang) : now.month() + 1;
        const nam = req.query.nam ? parseInt(req.query.nam) : now.year();

        // 2. Tính ngày bắt đầu và kết thúc của tháng để lọc trong bảng ChiPhi
        const startDate = dayjs
            .tz(`${nam}-${thang}-01`, "Asia/Ho_Chi_Minh")
            .startOf("month")
            .toDate();

        const endDate = dayjs
            .tz(`${nam}-${thang}-01`, "Asia/Ho_Chi_Minh")
            .endOf("month")
            .toDate();

        // Lấy các chi phí THỦ CÔNG tạo trong tháng
        const chiPhiThuCong = await ChiPhi.find({
            ngayTao: {
                $gte: startDate,
                $lte: endDate
            }
        })
            .sort({ ngayTao: -1 })
            .lean();

        // 3. Tổng hợp LƯƠNG NHÂN VIÊN từ bảng BangLuong
        const bangLuongList = await BangLuong.find({ thang, nam }).lean();

        const tongLuongThucNhan = bangLuongList.reduce(
            (sum, item) => sum + (item.thucNhan || 0),
            0
        );

        const chiPhiLuong = {
            _id: "auto_luong_nhan_vien",
            tenChiPhi: `Tổng lương nhân viên tháng ${thang}/${nam}`,
            loaiChiPhi: "Lương nhân viên",
            gia: tongLuongThucNhan,
            ghiChu: "Tự động đồng bộ từ Bảng lương",
            ngayTao: startDate,
            isAuto: true
        };

        // 4. Khởi tạo CHI PHÍ VẬT LIỆU (Giả lập, chờ làm Kho)
        const chiPhiVatLieu = {
            _id: "auto_chi_phi_vat_lieu",
            tenChiPhi: `Chi phí vật liệu tháng ${thang}/${nam}`,
            loaiChiPhi: "Vật tư",
            gia: 0,
            ghiChu: "Chờ đồng bộ từ xuất/nhập Kho",
            ngayTao: startDate,
            isAuto: true
        };

        // 5. Gộp danh sách và làm tròn tất cả giá về đơn vị nghìn
        const danhSachChiPhi = [
            chiPhiVatLieu,
            chiPhiLuong,
            ...chiPhiThuCong
        ].map(item => ({
            ...item,
            gia: Math.round((item.gia || 0) / 1000) * 1000
        }));

        res.status(200).json({
            success: true,
            data: danhSachChiPhi
        });

    } catch (error) {
        console.error("Lỗi khi lấy danh sách chi phí:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy danh sách chi phí",
            error: error.message
        });
    }
};