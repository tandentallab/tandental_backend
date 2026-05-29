const mongoose = require("mongoose");

// BƯỚC 1: IMPORT MODELS (Kiểm tra lại đường dẫn file model cho chuẩn nhé)
const HoaDon = require("./models/HoaDon");
const DonHang = require("./models/DonHang");
const PhieuThu = require("./models/PhieuThu");
const NhaKhoa = require("./models/NhaKhoa"); // 🔥 THÊM MODEL NHA KHOA

// BƯỚC 2: ĐIỀN LINK DATABASE
// ⚠️ Lưu ý: Mình đã thêm chữ "TanDental" vào ngay trước dấu "?" 
// để đảm bảo nó trỏ đúng vào database của bạn thay vì database mặc định (test).
const MONGODB_URI = "mongodb+srv://sjsang:Sang060604@tandental.qaqui98.mongodb.net/?appName=test";

const clearData = async () => {
    try {
        console.log("⏳ Đang kết nối lên MongoDB Atlas...");
        await mongoose.connect(MONGODB_URI);
        console.log("✅ Kết nối thành công!\n");

        console.log("🧹 Đang tiến hành hủy diệt dữ liệu...");

        // Dùng Promise.all để chạy song song các lệnh xóa và cập nhật
        const [delHoaDon, delDonHang, delPhieuThu, updateNhaKhoa] = await Promise.all([
            HoaDon.deleteMany({}),
            DonHang.deleteMany({}),
            PhieuThu.deleteMany({}),
            // 🔥 Reset số dư đầu kỳ của tất cả Nha Khoa về mảng rỗng
            NhaKhoa.updateMany({}, { $set: { soDuDauKy: [] } })
        ]);

        console.log(`💥 ĐÃ XÓA SẠCH SẼ & RESET:`);
        console.log(`- ${delHoaDon.deletedCount} Hóa đơn`);
        console.log(`- ${delDonHang.deletedCount} Đơn hàng`);
        console.log(`- ${delPhieuThu.deletedCount} Phiếu thu`);
        console.log(`- Đã reset trắng số dư đầu kỳ cho ${updateNhaKhoa.modifiedCount} Nha khoa\n`);

        console.log("✨ Xong! Database đã trắng tinh, bạn có thể test lại từ đầu rồi đó!");

    } catch (error) {
        console.error("❌ Lỗi trong quá trình xóa:", error);
    } finally {
        console.log("🔌 Đang ngắt kết nối Database...");
        await mongoose.disconnect();
        process.exit(0);
    }
};

clearData();