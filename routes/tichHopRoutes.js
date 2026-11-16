const express = require("express");
const router = express.Router();
const { xacThucCrm } = require("../middleware/crmApiKey");
const { layBangGiaChung, nhanBangGiaTuCrm, nhanNhaKhoaTuCrm, layNgayDonCuoi } = require("../controllers/tichHopController");

// API cho CRM gọi sang, xác thực bằng khoá API thay vì đăng nhập.
router.get("/san-pham", xacThucCrm, layBangGiaChung);
router.post("/bang-gia", xacThucCrm, nhanBangGiaTuCrm);
router.post("/nha-khoa", xacThucCrm, nhanNhaKhoaTuCrm);
router.get("/ngay-don-cuoi", xacThucCrm, layNgayDonCuoi);

module.exports = router;
