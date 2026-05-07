const express = require("express");
const router = express.Router();
const hoaDonController = require("../controllers/hoaDonController");

/* ================= QUẢN TRỊ (ADMIN) ================= */

// Lấy tất cả hóa đơn (Admin) - Hỗ trợ phân trang, lọc, tìm kiếm
router.get("/all", hoaDonController.getAllHoaDonAdmin);


/* ================= NGHIỆP VỤ HÓA ĐƠN ================= */

// Tạo hóa đơn mới
router.post("/", hoaDonController.createHoaDon);

// Lấy danh sách hóa đơn theo nha khoa
router.get("/nha-khoa/:nhaKhoaId", hoaDonController.getAllHoaDon);

// Lấy đơn hàng chưa xuất hóa đơn
router.get(
  "/don-hang-chua-xuat/:nhaKhoaId",
  hoaDonController.getDonHangChuaXuatHoaDon
);

// Cập nhật hóa đơn & Thanh toán (Sử dụng daThanhToan để cập nhật số dư)
router.put("/:id", hoaDonController.updateHoaDon);

// Thanh toán hóa đơn (partial payment)
router.post("/:id/thanh-toan", hoaDonController.thanhToanHoaDon);

router.delete("/:id", hoaDonController.deleteHoaDon)

module.exports = router;