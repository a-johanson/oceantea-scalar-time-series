const express = require("express");
const validator = require("validator");
const auth = require("./auth");
const db = require("./db");

const router = express.Router();

router.get("/", function(req, res) {
	res.json(db.getTypesDB());
});

router.get("/:typename", function(req, res) {
	res.json(db.getTypeFromTypesDB(req.params.typename));
});
router.put("/:typename", auth, function(req, res) {
	var printName = req.query.hasOwnProperty("printName") ? req.query.printName : "";
	var unit = req.query.hasOwnProperty("unit") ? req.query.unit : "";
	printName = validator.blacklist(printName, "<>&\"'#;");
	unit = validator.blacklist(unit, "<>\"'");
	const result = db.updateTypesDBSync(req.params.typename, printName, unit);
	res.status(result ? 200 : 500).json({ success: result });
});


module.exports = router;
