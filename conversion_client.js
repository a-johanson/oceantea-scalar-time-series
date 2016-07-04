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

const http = require("http");

const conversionServiceAddr = "127.0.0.1";
const conversionServicePort = 3337;

function getIOSeries(timeout, callback) {
	var req = http.request({
			hostname: conversionServiceAddr,
			port: conversionServicePort,
			path: "/conversion",
			method: "GET",
		}, function(res) {
			var body = "";
			res.on("data", function(chunk) {
				body += chunk;
			});
			res.on("end", function() {
				if(res.statusCode !== 200) {
					callback();
					return;
				}
				var responseObj = null;
				try {
					responseObj = JSON.parse(body);
				} catch(e) {
					callback();
					return;
				}
				callback(responseObj);
			});
		});
	req.on("error", function(e) {
		callback();
	});
	req.on("socket", function(socket) {
		socket.setTimeout(timeout);  
		socket.on("timeout", function() {
			req.abort();
			//callback(); <- do not call this because abort() fires error event for req.
		});
	});
	req.end();
}

function getConvertedSeries(timeout, lat, lon, inputSeries, callback) {
	var req = http.request({
			hostname: conversionServiceAddr,
			port: conversionServicePort,
			path: "/conversion",
			method: "POST",
			headers: {
				"Content-type": "application/json"
			}
		}, function(res) {
			var body = "";
			res.on("data", function(chunk) {
				body += chunk;
			});
			res.on("end", function() {
				if(res.statusCode !== 200) {
					callback();
					return;
				}
				var responseObj = null;
				try {
					responseObj = JSON.parse(body);
				} catch(e) {
					callback();
					return;
				}
				callback(responseObj);
			});
		});
	req.on("error", function(e) {
		callback();
	});
	req.on("socket", function(socket) {
		socket.setTimeout(timeout);  
		socket.on("timeout", function() {
			req.abort();
			//callback(); <- do not call this because abort() fires error event for req.
		});
	});
	try {
		req.write(JSON.stringify({
			lat: lat,
			lon: lon,
			inputSeries: inputSeries
		}));
	} catch(e) {
	}
	req.end();
}

module.exports.getIOSeries = getIOSeries;
module.exports.getConvertedSeries = getConvertedSeries;
