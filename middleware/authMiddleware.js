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

      let appRole = req.user.appRole;

      // Token cũ có thể chưa chứa appRole, fallback sang DB.
      if (!appRole) {
        const staff = await Staff.findById(req.user.id).populate("quyenSuDung");
        if (!staff) {
          return res.status(401).json({ message: "Tài khoản không tồn tại" });
        }
        appRole = resolveAppRoleFromStaff(staff);
      }

      req.user.appRole = appRole;

      if (!normalizedAllowedRoles.has(String(appRole).toLowerCase())) {
        return res.status(403).json({
          message: "Bạn không có quyền truy cập tài nguyên này",
          appRole,
          allowedRoles: Array.from(normalizedAllowedRoles),
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({ message: error.message || "Lỗi phân quyền" });
    }
  };
};

exports.APP_ROLES = APP_ROLES;