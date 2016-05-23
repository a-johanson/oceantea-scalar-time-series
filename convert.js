const db = require("./db");
const conversionClient = require("./conversion_client");

function tryToConvertCTP(station, depth, timeseries, handeledTS) {
	var i_conductivity = -1;
	var i_temperature = -1;
	var i_pressure = -1;
	
	if(!timeseries.some(function(ts, index) {
		if(ts.station === station && ts.depth === depth && !handeledTS[index]) {
			if(ts.dataType === "conductivity") {
				i_conductivity = index;
				handeledTS[index] = true;
			}
			else if(ts.dataType === "temperature") {
				i_temperature = index;
				handeledTS[index] = true;
			}
			else if(ts.dataType === "pressure") {
				i_pressure = index;
				handeledTS[index] = true;
			}
			return (i_conductivity >= 0 && i_temperature >= 0 && i_pressure >= 0);
		}
	})) {
		console.log(i_temperature);
		db.getTSCached(station, "conductivity", depth, true, function(condData) {
			console.log(condData[0]);
			db.getTSCached(station, "temperature", depth, true, function(tempData) {
				db.getTSCached(station, "pressure", depth, true, function(pressData) {
					var ctpSeries = condData.map(function(elem, index) {
						//return [elem[0], elem[1], tempData[index][1], pressData[index][1]];
						return [1, 34, 6, 212];
					});
					console.log(i_temperature);
					conversionClient.getConvertedSeries(15000, 
						timeseries[i_temperature].lat, timeseries[i_temperature].lon, ctpSeries, 
						function(converted) {
							//res.json(converted);
							//console.log(converted);
						});
				});
			});		
		});
	}
}

module.exports = function (req, res) {
	const timeseries = db.getTSDB().timeseries;
	handeledTS = timeseries.map(function(ts) {
		return false;
	});
	timeseries.forEach(function(ts, index) {
		if((ts.dataType == "conductivity" || ts.dataType == "temperature" || ts.dataType == "pressure")
		&& handeledTS[index] == false) {
			tryToConvertCTP(ts.station, ts.depth, timeseries, handeledTS);
		}
	});
	res.json({success: true});
};

