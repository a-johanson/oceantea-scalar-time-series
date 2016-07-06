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

const fs = require("fs");


function fileExistsSync(path) {
	try {
		if(fs.statSync(path).isFile()) {
			return true;
		}
	} catch(err) {
		return false;
	}
	return false;
}

function JSONDB(path, emptyContent) {
	this.dbPath = path;
	this.db = emptyContent;

	if(fileExistsSync(this.dbPath)) {
		try {
			this.db = JSON.parse(fs.readFileSync(this.dbPath, "utf8"));
		} catch(err) {	}
	}
}

JSONDB.prototype.writeSync = function() {
	try {
		fs.writeFileSync(this.dbPath, JSON.stringify(this.db));
	} catch(err) {
		return false;
	}
	return true;
};

const tsDBFile = "./data/ts.json";
const tsDBDataDir = "./data/ts/";
try {
	fs.mkdirSync(tsDBDataDir);
} catch (err) {}
var tsDB = new JSONDB(tsDBFile, { timeseries: [] });
// TSDB has structure { timeseries: [ {
//  region: string,
//  regionPrintName: string,
//  device: string,
//  tsType: string, (timeSeriesType: "scalar" [or "adcp"])
//  station: string,
//  dataType: string, (measurementType)
//  lat: float,
//  lon: float,
//  depth: int,
//  t_reference: string
//  [[adcpDirection: "up"/"down"]]
//  [[adcpFirstBinHeight: float]]
//  [[adcpBinHeight: float]]
// } ] }

const typesDBFile = "./data/datatypes.json";
var typesDB = new JSONDB(typesDBFile, { });
refreshTypesDBSync();
// An entry consists of
// typeKey: {
//  printName string,
//  unit: string
// }

var stationsDB;
resetStationsDB();
// An entry consists of
// stationKey: {
//  region: string,
//  regionPrintName: string,
//  device: string,
//  lat float,
//  lon: float,
//  depths: [int]
// }

var devicesDB;
resetDevicesDB();
// has structure
// { devices: [deviceID: string] }

var regionsDB;
resetRegionsDB();
// An entry consists of
// regionKey: {
//  printName: string
// }


var tsDataCache = {};
// An entry consists of
// cacheKey: {
//  loading : true/false,
//  timeAdded: int,
//  callbacks: [],
//  data: null/[[int,float]]/Buffer,
// }


function getTSDataCacheKey(station, dataType, depth, original) {
	return station+"-"+dataType+"-"+depth+"-"+(original ? "org" : "ed");
}
function getTSFilePath(station, dataType, depth, original) {
	return tsDBDataDir + "scalar_" + station + "_" + dataType + "_" + depth + "_" + (original ? "original" : "edited") + ".json";
}


 function getCacheTimeStamp() {
	 return Math.floor((new Date().getTime())/1000);
 }

function addArrayDataToCache(station, dataType, depth, original, dataBuffer) {
	var key = getTSDataCacheKey(station, dataType, depth, original);
	tsDataCache[key] = {
		loading: false,
		timeAdded: getCacheTimeStamp(),
		callbacks: [],
		data: dataBuffer
	};
}

function removeTSFromCache(station, dataType, depth, original) {
	var key = getTSDataCacheKey(station, dataType, depth, original);
	if(tsDataCache.hasOwnProperty(key)) {
		delete tsDataCache[key];
	}
}

function getTSCached(station, dataType, depth, original, callback) {
	var key = getTSDataCacheKey(station, dataType, depth, original);
	if(tsDataCache.hasOwnProperty(key)) {
		if(!tsDataCache[key].loading) {
			//console.log("Found TS in cache.");
			callback(tsDataCache[key].data);
		}
		else {
			//console.log("Found TS in cache but it was still loading.");
			tsDataCache[key].callbacks.push(callback);
		}
	}
	else {
		//console.log("TS is not in cache; loading it now.");
		tsDataCache[key] = {
			loading: true,
			timeAdded: getCacheTimeStamp(),
			callbacks: [callback],
			data: null
		};
		fs.readFile(getTSFilePath(station, dataType, depth, original), "utf8", function(err, data) {
			//console.log("TS is now loaded.");
			if(!tsDataCache.hasOwnProperty(key) || !tsDataCache[key].loading) { // key could have been deleted or manually filled in the meantime!
				return;
			}
			if(err) {
				tsDataCache[key].callbacks.forEach(function(cb) {
					cb([]);
				});
				delete tsDataCache[key];
				return;
			}

			var dataObj;
			try {
				dataObj = JSON.parse(data);
			} catch(err) {
				tsDataCache[key].callbacks.forEach(function(cb) {
					cb([]);
				});
				delete tsDataCache[key];
				return;
			}

			tsDataCache[key].data = dataObj.data;
			tsDataCache[key].timeAdded = getCacheTimeStamp();
			tsDataCache[key].loading = false;
			tsDataCache[key].callbacks.forEach(function(cb) {
				cb(dataObj.data);
			});
			tsDataCache[key].callbacks = [];
		});
	}
}

function getTSMetadata(station, dataType, depth) {
	var index = tsDB.db.timeseries.length - 1;
	while(index >= 0) {
		if(tsDB.db.timeseries[index].station == station
			//&& tsDB.db.timeseries[index].tsType == "scalar"
			&& tsDB.db.timeseries[index].dataType == dataType
			&& tsDB.db.timeseries[index].depth == depth) {
			return tsDB.db.timeseries[index];
		}
		index -= 1;
	}
	return null;
}

function deleteTSSync(station, dataType, depth) {
	removeTSFromCache(station, dataType, depth, true);
	removeTSFromCache(station, dataType, depth, false);
	try {
		fs.unlinkSync(getTSFilePath(station, dataType, depth, true));
		fs.unlinkSync(getTSFilePath(station, dataType, depth, false));
	} catch(e) { }

	var index = tsDB.db.timeseries.length - 1;
	while(index >= 0) {
		if(tsDB.db.timeseries[index].station == station
			//&& tsDB.db.timeseries[index].tsType == "scalar"
			&& tsDB.db.timeseries[index].dataType == dataType
			&& tsDB.db.timeseries[index].depth == depth) {
			tsDB.db.timeseries.splice(index, 1);
		}
		index -= 1;
	}

	return writeTSDBSync();
}



function getRegionsDB() {
	return regionsDB;
}

function resetRegionsDB() {
	regionsDB = {};
	tsDB.db.timeseries.forEach(function(ts) {
		if(!regionsDB.hasOwnProperty(ts.region)) {
			regionsDB[ts.region] = {
				printName : ts.regionPrintName
			};
		}
	});
}



function getDevicesDB() {
	return devicesDB;
}

function resetDevicesDB() {
	devicesDB = { devices: [] };
	tsDB.db.timeseries.forEach(function(ts) {
		if(devicesDB.devices.indexOf(ts.device) == -1) {
			devicesDB.devices.push(ts.device);
		}
	});
}




function getStationsDB() {
	return stationsDB;
}

function resetStationsDB() {
	stationsDB = {};
	tsDB.db.timeseries.forEach(function(ts) {
		if(!stationsDB.hasOwnProperty(ts.station)) {
			stationsDB[ts.station] = {
				region: ts.region,
				regionPrintName: ts.regionPrintName,
				device: ts.device,
				lat: ts.lat,
				lon: ts.lon,
				depths: [ts.depth]
			};
		}
		else if(stationsDB[ts.station].depths.indexOf(ts.depth) == -1) {
			stationsDB[ts.station].depths.push(ts.depth);
		}
	});
}




function getTypesDB() {
	return typesDB.db;
}

function getTypeFromTypesDB(typeName) {
	if(typesDB.db.hasOwnProperty(typeName)) {
		return typesDB.db[typeName];
	}
	return {printName: "", unit: ""};
}

function refreshTypesDBSync() {
	// Add types that are present in the tsDB but not in the typesDB.
	tsDB.db.timeseries.forEach(function(v) {
		if(!typesDB.db.hasOwnProperty(v.dataType)) {
			typesDB.db[v.dataType] = {printName: "", unit: ""};
		}
	});

	// Remove types that are present in the typesDB but not in the tsDB.
	Object.getOwnPropertyNames(typesDB.db).forEach(function(typeName) {
		if(tsDB.db.timeseries.every(function(v) {
			return (v.dataType !== typeName);
		})) {
			delete typesDB.db[typeName];
		}
	});

	return typesDB.writeSync();
}

function updateTypesDBSync(typeName, printName, unit) {
	// Does the type exist?
	if(!typesDB.db.hasOwnProperty(typeName)) {
		return false;
	}

	// If so, update the type
	typesDB.db[typeName].printName = printName;
	typesDB.db[typeName].unit = unit;
	return typesDB.writeSync();
}




function getTSDB() {
	return tsDB.db;
}

function addScalarTStoTSDBSync(header, metadata, data, col) {
	var originalDataPath = getTSFilePath(metadata.station, header[col], metadata.depth, true);
	var editedDataPath = getTSFilePath(metadata.station, header[col], metadata.depth, false);
	if(fileExistsSync(originalDataPath)) {
		// TODO: Was tun, wenn die Datei bereits existiert?
		return false;
	}

	var tsData = data.map(function(v) { return [v[0], v[col]]; });

	try {
		var tsDataString = JSON.stringify({data:tsData});
		fs.writeFileSync(originalDataPath, tsDataString);
		fs.writeFileSync(editedDataPath,   tsDataString);
	} catch(err) {
		// TODO: Überprüfe ob die Dateien doch schon erzeugt wurden und lösche sie ggf.
		return false;
	}

	tsDB.db.timeseries.push({
		region: metadata.region,
		regionPrintName: metadata.regionPrintName,
		device: metadata.device,
		tsType: metadata.tsType,
		station: metadata.station,
		dataType: header[col],
		lat: metadata.lat,
		lon: metadata.lon,
		depth: metadata.depth,
		t_reference: metadata.t_reference
	});

	// Add TS to cache
	addArrayDataToCache(metadata.tsType, metadata.station, header[col], metadata.depth, true, tsData);
	addArrayDataToCache(metadata.tsType, metadata.station, header[col], metadata.depth, false, tsData);

	return true;
}

function writeTSDBSync() {
	resetStationsDB();
	resetDevicesDB();
	resetRegionsDB();
	refreshTypesDBSync();
	return tsDB.writeSync();
};

module.exports.getTSDB = getTSDB;
//module.exports.getTSFilePath = getTSFilePathOriginal;
module.exports.addScalarTStoTSDBSync = addScalarTStoTSDBSync;
module.exports.writeTSDBSync = writeTSDBSync;

module.exports.getTSMetadata = getTSMetadata;
module.exports.deleteTSSync = deleteTSSync;
module.exports.getTSCached = getTSCached;

module.exports.getTypesDB = getTypesDB;
module.exports.getTypeFromTypesDB = getTypeFromTypesDB;
module.exports.refreshTypesDBSync = refreshTypesDBSync;
module.exports.updateTypesDBSync = updateTypesDBSync;

module.exports.getStationsDB = getStationsDB;
module.exports.resetStationsDB = resetStationsDB;

module.exports.getRegionsDB = getRegionsDB;
module.exports.resetRegionsDB = resetRegionsDB;

module.exports.getDevicesDB = getDevicesDB;
module.exports.resetDevicesDB = resetDevicesDB;
