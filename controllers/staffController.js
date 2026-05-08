const Staff = require("../models/Staff");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// 🔑 Tạo JWT
const generateToken = (staff) => {
  return jwt.sign(
    {
      id: staff._id,
      MSNV: staff.MSNV,
      Email: staff.Email,
      role: staff.ChucVu,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE,
    }
  );
};

// ✅ Tạo nhân viên (Admin tạo trực tiếp)
exports.createStaff = async (req, res) => {
  try {
    const { HoTenNV, Email, Password, ChucVu, Permissions, Status, MSNV } = req.body;

    // Kiểm tra Email bắt buộc
    if (!Email) {
      return res.status(400).json({ message: "Email là bắt buộc" });
    }

    // Kiểm tra định dạng Email
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(Email)) {
      return res.status(400).json({ message: "Email không hợp lệ" });
    }

    // Kiểm tra Tên bắt buộc
    if (!HoTenNV) {
      return res.status(400).json({ message: "Tên nhân viên là bắt buộc" });
    }

    // Kiểm tra Password bắt buộc
    if (!Password) {
      return res.status(400).json({ message: "Mật khẩu là bắt buộc" });
    }

    // Kiểm tra Email đã tồn tại
    const emailExist = await Staff.findOne({ Email: Email.toLowerCase() });
    if (emailExist) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    // Kiểm tra MSNV nếu cung cấp
    if (MSNV) {
      const msNvExist = await Staff.findOne({ MSNV });
      if (msNvExist) {
        return res.status(400).json({ message: "Mã số nhân viên đã tồn tại" });
      }
    }

    // Tạo nhân viên mới
    const newStaff = new Staff({
      MSNV: MSNV || null,
      HoTenNV,
      Email: Email.toLowerCase(),
      Password,
      ChucVu: ChucVu || "Thành viên",
      Permissions: Permissions || "",
      Status: Status !== undefined ? Status : 1,
    });

    await newStaff.save();

    res.status(201).json({
      message: "Tạo nhân viên thành công",
      staff: {
        id: newStaff._id,
        MSNV: newStaff.MSNV,
        HoTenNV: newStaff.HoTenNV,
        Email: newStaff.Email,
        ChucVu: newStaff.ChucVu,
        Status: newStaff.Status,
        Permissions: newStaff.Permissions,
        createdAt: newStaff.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔑 Đăng nhập
exports.loginStaff = async (req, res) => {
  try {
    const { MSNV, Email, Password } = req.body;

    // Tìm theo MSNV hoặc Email
    let staff = null;
    if (MSNV) {
      staff = await Staff.findOne({ MSNV });
    } else if (Email) {
      staff = await Staff.findOne({ Email: Email.toLowerCase() });
    }

    if (!staff) {
      return res.status(400).json({ message: "Tài khoản không tồn tại" });
    }

    // Kiểm tra Status
    if (staff.Status === 0) {
      return res.status(401).json({ message: "Tài khoản bị khóa" });
    }

    const isMatch = await staff.comparePassword(Password);
    if (!isMatch) {
      return res.status(400).json({ message: "Sai mật khẩu" });
    }

    const token = generateToken(staff);

    res.json({
      message: "Đăng nhập thành công",
      token,
      staff: {
        id: staff._id,
        MSNV: staff.MSNV,
        HoTenNV: staff.HoTenNV,
        Email: staff.Email,
        ChucVu: staff.ChucVu,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📋 Lấy danh sách nhân viên
exports.getAllStaff = async (req, res) => {
  try {
    const staffs = await Staff.find().select("-Password");
    res.json(staffs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔍 Lấy 1 nhân viên
exports.getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id).select("-Password");
    if (!staff) {
      return res.status(404).json({ message: "Không tìm thấy" });
    }
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✏️ Cập nhật nhân viên
exports.updateStaff = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({ message: "Không tìm thấy" });
    }

    // Nếu cập nhật Email, kiểm tra tính hợp lệ
    if (req.body.Email && req.body.Email !== staff.Email) {
      const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (!emailRegex.test(req.body.Email)) {
        return res.status(400).json({ message: "Email không hợp lệ" });
      }

      const emailExist = await Staff.findOne({
        Email: req.body.Email.toLowerCase(),
        _id: { $ne: req.params.id }
      });
      if (emailExist) {
        return res.status(400).json({ message: "Email đã tồn tại" });
      }

      req.body.Email = req.body.Email.toLowerCase();
    }

    // Nếu cập nhật MSNV, kiểm tra tính hợp lệ
    if (req.body.MSNV && req.body.MSNV !== staff.MSNV) {
      const msNvExist = await Staff.findOne({
        MSNV: req.body.MSNV,
        _id: { $ne: req.params.id }
      });
      if (msNvExist) {
        return res.status(400).json({ message: "Mã số nhân viên đã tồn tại" });
      }
    }

    Object.assign(staff, req.body);

    // Nếu đổi password → hash lại
    if (req.body.Password) {
      staff.Password = req.body.Password;
    }

    await staff.save();

    res.json({
      message: "Cập nhật thành công",
      staff: {
        id: staff._id,
        MSNV: staff.MSNV,
        HoTenNV: staff.HoTenNV,
        Email: staff.Email,
        ChucVu: staff.ChucVu,
        Status: staff.Status,
        Permissions: staff.Permissions,
        updatedAt: staff.updatedAt,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ❌ Xóa nhân viên
exports.deleteStaff = async (req, res) => {
  try {
    await Staff.findByIdAndDelete(req.params.id);
    res.json({ message: "Xóa thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};