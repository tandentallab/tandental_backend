const express = require("express");
const router = express.Router();
const publicController = require("../controllers/publicController");

router.get("/check-warranty/:code", publicController.checkWarranty);

module.exports = router;
