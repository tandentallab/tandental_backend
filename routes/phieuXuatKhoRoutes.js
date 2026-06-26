const express = require('express');
const router = express.Router();
const phieuXuatKhoController = require('../controllers/PhieuXuatKhoController');

router.get('/', phieuXuatKhoController.getAll);
router.post('/', phieuXuatKhoController.create);
router.get('/:id', phieuXuatKhoController.getById);
router.patch('/:id', phieuXuatKhoController.update);
router.delete('/:id', phieuXuatKhoController.delete);

module.exports = router;
