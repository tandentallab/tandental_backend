const mongoose = require("mongoose");
const ChiPhi = require("./models/ChiPhi"); // Đảm bảo đường dẫn này trỏ đúng tới file model ChiPhi của bạn

// Chuỗi kết nối từ file xoa.js
const MONGO_URI = "mongodb+srv://sjsang:Sang060604@tandental.qaqui98.mongodb.net/?appName=test";

// Các danh mục mẫu để random
const LOAI_CHI_PHI = ["Nhập vật tư", "Điện nước", "Bảo trì thiết bị", "Marketing", "Lương nhân viên", "Khác"];
const TEN_CHI_PHI = [
    "Mua composite và keo dán",
    "Thanh toán tiền điện",
    "Thanh toán tiền nước",
    "Sửa chữa ghế nha khoa",
    "Chạy quảng cáo Facebook",
    "Mua mũi khoan nội nha",
    "Mua thuốc tê",
    "Lương nhân viên phụ tá"
];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seedChiPhi() {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Kết nối DB thành công");

    const docs = [];

    // Tạo data cho tháng 6 năm 2026
    const year = 2026;
    const month = 5; // Trong JavaScript, tháng bắt đầu từ 0 (5 = Tháng 6)

    // Lặp qua 30 ngày của tháng 6
    for (let day = 1; day <= 30; day++) {
        // Tạo 5 chi phí cho mỗi ngày
        for (let i = 0; i < 5; i++) {
            // Random giờ phút trong ngày giờ hành chính để data thực tế hơn (từ 8h đến 18h)
            const hour = randInt(8, 18);
            const minute = randInt(0, 59);
            const second = randInt(0, 59);

            const ngayTao = new Date(year, month, day, hour, minute, second);

            docs.push({
                tenChiPhi: `${randItem(TEN_CHI_PHI)} - Lần ${i + 1}`,
                loaiChiPhi: randItem(LOAI_CHI_PHI),
                gia: randInt(50, 5000) * 1000, // Random giá từ 50,000 đến 5,000,000 VNĐ
                ghiChu: "seed-test-chiphi", // Gắn cờ để dễ xóa sau khi test
                ngayTao: ngayTao
            });
        }
    }

    // Insert toàn bộ vào DB
    await ChiPhi.insertMany(docs, { ordered: false });
    console.log(`📦 Đã insert thành công ${docs.length} chi phí (5 chi phí/ngày trong 30 ngày)`);

    console.log(`\n✅ Xong! Quá trình tạo dữ liệu hoàn tất.`);
    console.log(`💡 Copy lệnh này để xóa data sau khi test FE xong:`);
    console.log(`db.chiphis.deleteMany({ ghiChu: "seed-test-chiphi" })`);

    await mongoose.disconnect();
}

seedChiPhi().catch((err) => {
    console.error("❌ Lỗi:", err.message);
    process.exit(1);
});