const parse = require("csv-parse");
const validator = require("validator");
const db = require("./db");

function sendFailureResponse(res, msg) {
	res.status(400).json({
		success : false,
		message : msg
	});
}


module.exports = function (req, res) {
	//console.log(req.body);
	//console.log(req.file);
	if(!req.file) {
		sendFailureResponse(res, "Upload failed!");
		return;
	}

	if(req.body.timeSeriesType!=="scalar") {
		sendFailureResponse(res, "Time series type must be scalar");
		return;
	}

	var stationExpr = /^[A-Za-z0-9]+[A-Za-z0-9\-]*[A-Za-z0-9]+$/;
	if(!stationExpr.test(req.body.station)) {
		sendFailureResponse(res, "Station ID is mal-formatted");
		return;
	}
	if(!validator.isInt(req.body.depth)) {
		sendFailureResponse(res, "Depth is mal-formatted");
		return;
	}
	var dateExpr = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;
	if(!dateExpr.test(req.body.referenceDate) || !validator.isDate(req.body.referenceDate)) {
		sendFailureResponse(res, "Reference date is mal-formatted");
		return;
	}

	var dateMatch = dateExpr.exec(req.body.referenceDate);
	var metadata = {
		station: req.body.station,
		depth: validator.toInt(req.body.depth),
		t_reference: dateMatch[1] + "T" + dateMatch[2] + "Z"
	};

	var stationsDB = db.getStationsDB();
	if(!stationsDB.hasOwnProperty(req.body.station)) {
		if(!validator.isFloat(req.body.latitude, {min: -90.0 , max: 90.0})) {
			sendFailureResponse(res, "Latitude is mal-formatted");
			return;
		}
		if(!validator.isFloat(req.body.longitude, {min: -180.0 , max: 180.0})) {
			sendFailureResponse(res, "Longitude is mal-formatted");
			return;
		}
		var regionExpr = /^[A-Za-z]+[A-Za-z ]*[A-Za-z]+$/;
		if(!regionExpr.test(req.body.region)) {
			sendFailureResponse(res, "Region name is mal-formatted");
			return;
		}
		var deviceExpr = /^[A-Za-z0-9]+[A-Za-z0-9\-]*[A-Za-z0-9]+$/;
		if(!deviceExpr.test(req.body.device)) {
			sendFailureResponse(res, "Device ID is mal-formatted");
			return;
		}

		metadata["lat"] = validator.toFloat(req.body.latitude);
		metadata["lon"] = validator.toFloat(req.body.longitude);
		metadata["region"] = req.body.region.toLowerCase().replace(/ /g, "-");
		metadata["regionPrintName"] = req.body.region;
		metadata["device"] = req.body.device;
	}
	else {
		metadata["lat"] = stationsDB[req.body.station].lat;
		metadata["lon"] = stationsDB[req.body.station].lon;
		metadata["region"] = stationsDB[req.body.station].region;
		metadata["regionPrintName"] = stationsDB[req.body.station].regionPrintName;
		metadata["device"] = stationsDB[req.body.station].device;
	}

	metadata["tsType"] = req.body.timeSeriesType;

	parse(req.file.buffer,
		{delimiter: ",", comment: "#", columns: null, skip_empty_lines: true, auto_parse:true},
		function(err, data) {
			if(err) {
				sendFailureResponse(res, "Parsing the CSV file failed!");
				return;
			}
			if(data[0][0] != "timestamp" || data[0].length <= 1) {
				sendFailureResponse(res, "Mal-formatted CSV file!");
				return;
			}

			header = data.shift().map(function(v) {
				var wlstr = validator.whitelist(v, "A-Za-z0-9\-_");
				if(wlstr.length < 1) {
					return "unknown";
				}
				return wlstr;
			});

			var allTSWritten = true;
			for(var col=1; col<data[0].length; ++col) {
				var written = db.addScalarTStoTSDBSync(header, metadata, data, col);
				if(!written) {
					allTSWritten = false;
				}
			}
			db.writeTSDBSync();

			res.json({
				success : true,
				message : (allTSWritten ? "All time series added successfully." : "At least one time series already existed; the others were added successfully.")
			});
		});
};
