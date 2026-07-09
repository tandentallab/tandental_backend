const exporess = require('express');
const router = exporess.Router();
const phieuNhapKhoController = require('../controllers/phieuNhapKhoController');
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

router.get('/', phieuNhapKhoController.getAll);
router.post('/', phieuNhapKhoController.create);
router.get('/:id', phieuNhapKhoController.getById);
router.patch('/:id', phieuNhapKhoController.update);
router.delete('/:id', phieuNhapKhoController.delete);

module.exports = router;