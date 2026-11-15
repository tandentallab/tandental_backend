const express = require("express");
const router = express.Router();
const { xacThucCrm } = require("../middleware/crmApiKey");
const { layBangGiaChung, nhanBangGiaTuCrm } = require("../controllers/tichHopController");

// API cho CRM gọi sang, xác thực bằng khoá API thay vì đăng nhập.
router.get("/san-pham", xacThucCrm, layBangGiaChung);
router.post("/bang-gia", xacThucCrm, nhanBangGiaTuCrm);

module.exports = router;
