const express = require('express');
const router = express.Router();
const baoCaoController = require('../controllers/baoCaoController'); // Đường dẫn tới file controller ở trên

router.get('/top-products', baoCaoController.getTopProductsReport);
router.get("/detailed-report", baoCaoController.getDetailedProductReport);
module.exports = router;