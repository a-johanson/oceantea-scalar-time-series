// Copyright 2016 Arne Johanson
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
