const express = require("express");
const validator = require("validator");
const auth = require("./auth");
const db = require("./db");

const router = express.Router();

router.get("/", function(req, res) {
	if(req.query.hasOwnProperty("includeAggregatedMetadata")) {
		res.json({
			datatypes: db.getTypesDB(),
			regions: db.getRegionsDB(),
			stations: db.getStationsDB(),
			devices: db.getDevicesDB().devices,
			timeseries: db.getTSDB().timeseries
		});
	}
	else {
		res.json(db.getTSDB());
	}
});

function tsParametersAreInvalid(station, dataType, depth) {
	return (!/^[A-Za-z0-9\-]+$/.test(station)
		|| !/^[A-Za-z0-9\-_]+$/.test(dataType)
		|| !validator.isInt(depth));
}

router.get("/scalar/:station/:datatype/:depth", function(req, res) {
	if(tsParametersAreInvalid(req.params.station, req.params.datatype, req.params.depth)) {
		res.status(400).json({data: []});
		return;
	}
	db.getTSCached(req.params.station, req.params.datatype, req.params.depth, req.query.hasOwnProperty("original"), function(tsData) {
		res.json({data : tsData});
	});
});
router.delete("/scalar/:station/:datatype/:depth", auth, function(req, res) {
	if(tsParametersAreInvalid(req.params.station, req.params.datatype, req.params.depth)) {
		res.status(400).json({success: false});
		return;
	}

	var result = db.deleteTSSync(req.params.station, req.params.datatype, req.params.depth);
	res.status(result ? 200 : 500).json({success: result});
});

module.exports = router;
