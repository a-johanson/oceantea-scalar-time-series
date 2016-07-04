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

const db = require("./db");
const conversionClient = require("./conversion_client");


function tryToConvert(inputSeries, station, depth, timeseries, handeledTS, callback) {
	var inputIndices = inputSeries.map( (d) => -1 ); // inputIndices will hold the indices of inputSeries in timeseries
	
	if(timeseries.some(function(ts, index) {
		if(ts.station === station && ts.depth === depth && !handeledTS[index]) {
			inputSeries.some(function(d, di) {
				if(ts.dataType === d) {
					inputIndices[di] = index;
					handeledTS[index] = true;
					return true;
				}
				return false;
			});
		}
		return inputIndices.every( (i) => i > -1 );
	})) { // If all necessary input series were found:
		var selectedTSData = inputIndices.map( (d) => null );
		
		inputSeries.forEach(function(s, si) {
			db.getTSCached(station, s, depth, true, function(data) {
				selectedTSData[si] = data;
				
				if(selectedTSData.every( (d) => d !== null )) { // If all series have been loaded...
					if(!selectedTSData.every( (d) => d.length >= selectedTSData[0].length )) {
						if(callback) {
							callback(false);
						}
						return;
					}
					
					var combinedSeries = []; // ... combine them into one.
					selectedTSData[0].forEach(function(d, di) {
						combinedSeries[di] = [ selectedTSData[0][di][0] ];
						selectedTSData.forEach(function(ts) {
							combinedSeries[di].push(ts[di][1]);
						});
					});
					
					conversionClient.getConvertedSeries(15000, 
						timeseries[inputIndices[0]].lat, timeseries[inputIndices[0]].lon, combinedSeries, 
						function(converted) {
							if(!converted || !converted.hasOwnProperty("timestamps")) {
								if(callback) {
									callback(false);
								}
								return;
							}
							// Extract individual series...
							var outNames = Object.keys(converted);
							outNames.splice(outNames.indexOf("timestamps"), 1);
							outNames.forEach(function(name) {
								var ts = converted[name];
								ts = ts.map( (d, di) => [ converted.timestamps[di], d ] );
								db.addScalarTStoTSDBSync(["timestamp", name], timeseries[inputIndices[0]], ts, 1);
								db.writeTSDBSync();
							});
							if(callback) {
								callback(true);
							}
						});
				}
			});
		});
	}
	else if(callback) {
		callback(false);
	}
}

module.exports.tryToConvert = tryToConvert;
module.exports.convertHandler = function (req, res) {
	conversionClient.getIOSeries(2500, function(ioSeries) {
		if(!ioSeries || !ioSeries.hasOwnProperty("input") || !Array.isArray(ioSeries.input) || ioSeries.input.length <= 1) {
			res.status(500).send("Conversion service error");
			return;
		}
		
		const timeseries = db.getTSDB().timeseries;
		handeledTS = timeseries.map( (d) => false );
		
		var toConvert = 0;
		var doneConvert = 0;
		var allConvertsIssued = false;
		timeseries.forEach(function(ts, index) {
			if(ioSeries.input.indexOf(ts.dataType) > -1 && handeledTS[index] == false) {
				toConvert += 1;
				tryToConvert(ioSeries.input, ts.station, ts.depth, timeseries, handeledTS, function(success) {
					doneConvert += 1;
					if(allConvertsIssued && toConvert == doneConvert) {
						res.json({success: true});
					}
				});
			}
		});
		allConvertsIssued = true;
		if(toConvert == doneConvert) {
			toConvert += 1;
			res.json({success: true});
		}
	});
};

