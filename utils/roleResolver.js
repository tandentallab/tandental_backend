const APP_ROLES = {
  ADMIN: "admin",
  KE_TOAN: "ke-toan",
  NHAN_VIEN: "nhan-vien",
};

const normalizeRoleName = (value = "") => {
  return String(value)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "-");
};

const resolveRoleFromQuyenSuDungTen = (tenQuyenSuDung = "") => {
  const normalized = normalizeRoleName(tenQuyenSuDung);

  if (normalized === APP_ROLES.ADMIN) return APP_ROLES.ADMIN;
  if (normalized === APP_ROLES.KE_TOAN || normalized === "ketoan") return APP_ROLES.KE_TOAN;
  if (normalized === APP_ROLES.NHAN_VIEN || normalized === "nhanvien") return APP_ROLES.NHAN_VIEN;

  return null;
};

const resolveAppRoleFromStaff = (staff = {}) => {
  const roleByQuyen = resolveRoleFromQuyenSuDungTen(staff?.quyenSuDung?.ten);
  if (roleByQuyen) return roleByQuyen;

  return APP_ROLES.NHAN_VIEN;
};

module.exports = {
  APP_ROLES,
  normalizeRoleName,
  resolveAppRoleFromStaff,
};