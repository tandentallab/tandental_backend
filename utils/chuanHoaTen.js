// So khớp tên với CRM (tên nha khoa, tên sản phẩm): bỏ khác biệt hoa/thường,
// khoảng trắng thừa và dạng mã hoá dấu tiếng Việt. Giống normalizeName bên CRM.
const chuanHoaTen = (ten) => ten.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

module.exports = { chuanHoaTen };
