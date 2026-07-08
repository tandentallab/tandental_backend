const exporess = require('express');
const router = exporess.Router();
const phieuMuonVatLieuController = require('../controllers/phieuMuonVatLieuController');
const { verifyToken, checkPermission } = require("../middleware/authMiddleware");

router.get('/', phieuMuonVatLieuController.getAll);
router.post('/', phieuMuonVatLieuController.create);
router.get('/:id', phieuMuonVatLieuController.getById);
router.patch('/:id', phieuMuonVatLieuController.update);
router.delete('/:id', phieuMuonVatLieuController.delete);

module.exports = router;