const crypto = require("crypto");

// Xác thực các API tích hợp do CRM gọi: header "x-api-key" phải trùng
// CRM_API_KEY (dùng chung khoá với chiều lab -> CRM). Chưa cấu hình thì luôn
// từ chối. So sánh qua hash để độ dài khoá không ảnh hưởng thời gian phản hồi.
const hash = (value) => crypto.createHash("sha256").update(value).digest();

exports.xacThucCrm = (req, res, next) => {
  const expected = process.env.CRM_API_KEY;
  const received = req.headers["x-api-key"];
  if (!expected || typeof received !== "string" || !crypto.timingSafeEqual(hash(received), hash(expected))) {
    return res.status(401).json({ message: "unauthorized" });
  }
  next();
};
