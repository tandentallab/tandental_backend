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

// 👤 Lấy thông tin user hiện tại (từ token)
exports.getCurrentStaff = async (req, res) => {
  try {
    // req.user được set bởi middleware authMiddleware
    const staff = await Staff.findById(req.user.id)
      .select("-Password")
      .populate("quyenSuDung");

    if (!staff) {
      return res.status(404).json({ message: "Nhân viên không tồn tại" });
    }

    res.json({
      message: "Lấy thông tin user thành công",
      staff: {
        id: staff._id,
        MSNV: staff.MSNV,
        HoTenNV: staff.HoTenNV,
        Email: staff.Email,
        ChucVu: staff.ChucVu,
        quyenSuDung: staff.quyenSuDung,
        DienThoai: staff.DienThoai,
        DiaChi: staff.DiaChi,
        GioiThieu: staff.GioiThieu,
        Status: staff.Status,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Tạo nhân viên (Admin tạo trực tiếp)
exports.createStaff = async (req, res) => {
  try {
    const { HoTenNV, Email, Password, ChucVu, Permissions, Status, MSNV, quyenSuDung, DienThoai, DiaChi, GioiThieu } = req.body;

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
      quyenSuDung: quyenSuDung || null,
      DienThoai: DienThoai || "",
      DiaChi: DiaChi || "",
      GioiThieu: GioiThieu || "",
      Status: Status !== undefined ? Status : 1,
    });

    await newStaff.save();

    // Populate quyenSuDung trước khi trả về
    const staffWithQuyens = await Staff.findById(newStaff._id).populate("quyenSuDung");

    res.status(201).json({
      message: "Tạo nhân viên thành công",
      staff: {
        _id: staffWithQuyens._id,
        MSNV: staffWithQuyens.MSNV,
        HoTenNV: staffWithQuyens.HoTenNV,
        Email: staffWithQuyens.Email,
        ChucVu: staffWithQuyens.ChucVu,
        quyenSuDung: staffWithQuyens.quyenSuDung,
        DienThoai: staffWithQuyens.DienThoai,
        DiaChi: staffWithQuyens.DiaChi,
        GioiThieu: staffWithQuyens.GioiThieu,
        Status: staffWithQuyens.Status,
        createdAt: staffWithQuyens.createdAt,
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
    const staffs = await Staff.find().select("-Password").populate("quyenSuDung");
    res.json(staffs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔍 Lấy 1 nhân viên
exports.getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id).select("-Password").populate("quyenSuDung");
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

    // Populate quyenSuDung trước khi trả về
    const updatedStaff = await Staff.findById(staff._id).populate("quyenSuDung");

    res.json({ 
      message: "Cập nhật thành công",
      staff: {
        _id: updatedStaff._id,
        MSNV: updatedStaff.MSNV,
        HoTenNV: updatedStaff.HoTenNV,
        Email: updatedStaff.Email,
        ChucVu: updatedStaff.ChucVu,
        quyenSuDung: updatedStaff.quyenSuDung,
        DienThoai: updatedStaff.DienThoai,
        DiaChi: updatedStaff.DiaChi,
        GioiThieu: updatedStaff.GioiThieu,
        Status: updatedStaff.Status,
        createdAt: updatedStaff.createdAt,
        updatedAt: updatedStaff.updatedAt,
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