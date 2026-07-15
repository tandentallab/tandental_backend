const express = require('express');
const router = express.Router();
const chiPhiController = require('../controllers/chiPhiController'); //[cite: 3]
const { verifyToken, checkPermission } = require("../middleware/authMiddleware"); //[cite: 3]

// --- ROUTE CHO QUỸ CHI PHÍ (Nằm trong cùng controller và model ChiPhi) ---
router.post('/quy/nap', verifyToken, checkPermission, chiPhiController.napQuy);
router.get('/quy', verifyToken, checkPermission, chiPhiController.layThongTinQuy);

// --- ROUTE CŨ GIỮ NGUYÊN ---
router.post('/', verifyToken, checkPermission, chiPhiController.taoChiPhi); //[cite: 3]
router.get('/', verifyToken, checkPermission, chiPhiController.layDanhSachChiPhi); //[cite: 3]
router.get('/loai', verifyToken, checkPermission, chiPhiController.layDanhSachLoaiChiPhi); //[cite: 3]
router.delete('/:id', verifyToken, checkPermission, chiPhiController.xoaChiPhi); //[cite: 3]
router.put('/:id', verifyToken, checkPermission, chiPhiController.updateChiPhi); //[cite: 3]
router.get('/thong-ke-vat-lieu', verifyToken, checkPermission, chiPhiController.thongKeChiPhiNhapTheoThang); //[cite: 3]

module.exports = router; //[cite: 3]