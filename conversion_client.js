const http = require("http");

const conversionServiceAddr = "127.0.0.1";
const conversionServicePort = 3337;

function getConvertedSeries(timeout, lat, lon, ctpSeries, callback) {
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
			ctpSeries: ctpSeries
		}));
	} catch(e) {
	}
	req.end();
}

module.exports.getConvertedSeries = getConvertedSeries;
