const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Staff = require('./models/Staff');
const connectDB = require('./config/db.config');

dotenv.config();

const seedAdminAccount = async () => {
  try {
    await connectDB();

    console.log('🌱 Đang tạo admin account...');

    // Kiểm tra admin đã tồn tại chưa
    const existingAdmin = await Staff.findOne({ Email: 'ketoan@gmail.com' });
    if (existingAdmin) {
      console.log('✅ Admin account đã tồn tại!');
      process.exit(0);
    }

    // Tạo admin account mới
    const adminAccount = new Staff({
      MSNV: 'ADMIN',
      HoTenNV: 'Kế Toán',
      Email: 'admin@gmail.com',
      Password: '123456', // Sẽ được hash tự động bởi pre('save')
      ChucVu: 'Sở hữu',
      Permissions: 'Toàn quyền',
      Status: 1,
    });

    await adminAccount.save();

    console.log('✅ Admin account tạo thành công!');
    console.log('📧 Email: ketoan@gmail.com');
    console.log('🔑 Password: 123456');
    console.log('👤 Role: Sở hữu (Admin)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
};

seedAdminAccount();
