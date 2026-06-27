const jwt = require("jsonwebtoken");
const Staff = require("../models/Staff");
const { APP_ROLES, resolveAppRoleFromStaff } = require("../utils/roleResolver");

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Không có token" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next(); // ✅ QUAN TRỌNG
  } catch (err) {
    return res.status(403).json({ message: "Token không hợp lệ" });
  }
};

exports.authorizeRoles = (...allowedRoles) => {
  const normalizedAllowedRoles = new Set(
    allowedRoles.filter(Boolean).map((role) => String(role).trim().toLowerCase())
  );

  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Chưa xác thực tài khoản" });
      }

      // Luôn truy vấn thông tin nhân viên mới nhất từ DB để lấy permissions động thời gian thực
      const staff = await Staff.findById(req.user.id).populate("quyenSuDung");
      if (!staff) {
        return res.status(401).json({ message: "Tài khoản không tồn tại" });
      }

      const appRole = resolveAppRoleFromStaff(staff);
      req.user.appRole = appRole;

      // 1. Nếu là Admin thì luôn luôn được phép truy cập
      if (appRole === APP_ROLES.ADMIN) {
        return next();
      }

      // 2. Kiểm tra phân quyền động (Dynamic Permissions)
      const permissions = staff.quyenSuDung?.permissions || [];
      const baseUrl = req.baseUrl || "";

      // Ánh xạ từ api path (req.baseUrl) sang frontend menu path
      const pathMap = {
        "/api/nhakhoa": "/nha-khoa",
        "/api/nguoilienhe": "/nguoi-lien-he",
        "/api/benhnhan": "/benh-nhan",
        "/api/sanpham": "/san-pham",
        "/api/congdoan": "/cong-doan",
        "/api/donhang": "/don-hang",
        "/api/hoa-don": "/hoa-don",
        "/api/phieu-thu": "/phieu-thu",
        "/api/phieu-bao-hanh": "/phieu-bao-hanh",
        "/api/mau-the-bao-hanh": "/mau-the-bao-hanh",
        "/api/nhan-vien": "/nhan-vien",
        "/api/bang-luong": "/bang-luong",
        "/api/baocao": "/bao-cao",
        "/api/quyen-su-dung": "/quyen-su-dung",
        "/api/cong-ty": "/cong-ty",
        "/api/nha-cung-cap": "/nha-cung-cap",
        "/api/ghi-chu": "/ghi-chu",
      };

      const mappedMenuPath = pathMap[baseUrl];

      // Nếu tài khoản có quyenSuDung được gán và route thuộc sơ đồ menu động
      if (staff.quyenSuDung && mappedMenuPath) {
        // Danh sách các catalog/danh mục cần cho phép đọc (GET) để làm dropdown ở các trang khác
        const isCatalogLookup = [
          "/api/nhakhoa",
          "/api/sanpham",
          "/api/benhnhan",
          "/api/nguoilienhe",
          "/api/congdoan",
          "/api/nhan-vien",
          "/api/bang-gia",
          "/api/mau-the-bao-hanh"
        ].includes(baseUrl);

        if (req.method === "GET" && isCatalogLookup) {
          return next(); // Cho phép đọc danh mục hỗ trợ (dropdown/charts)
        }

        if (permissions.includes(mappedMenuPath)) {
          return next();
        } else {
          // Bị từ chối quyền truy cập động
          return res.status(403).json({
            message: `Tài khoản của bạn không có quyền truy cập chức năng này (yêu cầu quyền: ${mappedMenuPath})`,
            appRole,
            requiredPermission: mappedMenuPath,
          });
        }
      }

      // 3. Fallback: Kiểm tra vai trò cứng đối với các api đặc thù/cũ
      if (normalizedAllowedRoles.has(String(appRole).toLowerCase())) {
        return next();
      }

      return res.status(403).json({
        message: "Bạn không có quyền truy cập tài nguyên này",
        appRole,
        allowedRoles: Array.from(normalizedAllowedRoles),
        requiredPermission: mappedMenuPath || baseUrl,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Lỗi phân quyền" });
    }
  };
};

exports.checkPermission = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Chưa xác thực tài khoản" });
    }

    const staff = await Staff.findById(req.user.id).populate("quyenSuDung");
    if (!staff) {
      return res.status(401).json({ message: "Tài khoản không tồn tại" });
    }

    const appRole = resolveAppRoleFromStaff(staff);
    req.user.appRole = appRole;

    // 1. Admin luôn luôn được phép truy cập
    if (appRole === APP_ROLES.ADMIN) {
      return next();
    }

    // Chặn DELETE đơn hàng
    if (
      req.method === "DELETE" &&
      req.baseUrl === "/api/donhang"
    ) {
      return res.status(403).json({
        message: "Chỉ Admin mới được xóa đơn hàng"
      });
    }

    // 2. Kiểm tra phân quyền động (Dynamic Permissions)
    const permissions = staff.quyenSuDung?.permissions || [];
    const baseUrl = req.baseUrl || "";

    const pathMap = {
      "/api/nhakhoa": "/nha-khoa",
      "/api/nguoilienhe": "/nguoi-lien-he",
      "/api/benhnhan": "/benh-nhan",
      "/api/sanpham": "/san-pham",
      "/api/congdoan": "/cong-doan",
      "/api/donhang": "/don-hang",
      "/api/hoa-don": "/hoa-don",
      "/api/phieu-thu": "/phieu-thu",
      "/api/phieu-bao-hanh": "/phieu-bao-hanh",
      "/api/mau-the-bao-hanh": "/mau-the-bao-hanh",
      "/api/nhan-vien": "/nhan-vien",
      "/api/bang-luong": "/bang-luong",
      "/api/baocao": "/bao-cao",
      "/api/quyen-su-dung": "/quyen-su-dung",
      "/api/cong-ty": "/cong-ty",
      "/api/nha-cung-cap": "/nha-cung-cap",
      "/api/ghi-chu": "/ghi-chu",
    };

    const mappedMenuPath = pathMap[baseUrl];

    // Nếu tài khoản có quyenSuDung được gán và route thuộc sơ đồ menu động
    if (staff.quyenSuDung && mappedMenuPath) {
      const isCatalogLookup = [
        "/api/nhakhoa",
        "/api/sanpham",
        "/api/benhnhan",
        "/api/nguoilienhe",
        "/api/congdoan",
        "/api/nhan-vien",
        "/api/bang-gia",
        "/api/mau-the-bao-hanh"
      ].includes(baseUrl);

      if (req.method === "GET" && isCatalogLookup) {
        return next(); // Cho phép đọc danh mục hỗ trợ (dropdown/charts)
      }

      if (permissions.includes(mappedMenuPath)) {
        return next();
      } else {
        // Bị từ chối quyền truy cập động
        return res.status(403).json({
          message: `Tài khoản của bạn không có quyền truy cập chức năng này (yêu cầu quyền: ${mappedMenuPath})`,
          appRole,
          requiredPermission: mappedMenuPath,
        });
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: error.message || "Lỗi phân quyền động" });
  }
};

exports.APP_ROLES = APP_ROLES;