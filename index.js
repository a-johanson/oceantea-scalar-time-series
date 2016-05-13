try {
	process.chdir(__dirname);
}
catch(err) {
	console.log("Could not change working directory to app root");
	process.exit(1);
}

const express = require("express");
const multer  = require("multer");
const auth = require("./auth");
const db = require("./db");

const localAddr = "127.0.0.1";
const appPort = 3335;

const app = express();

const upload = multer({ storage: multer.memoryStorage() });
app.post("/upload", auth, upload.single("dataFile"), require("./upload"));

app.use("/timeseries", require("./timeseries"));

app.use("/datatypes", require("./datatypes"));

app.get("/stations", function(req, res) {
	res.json(db.getStationsDB());
});

app.get("/regions", function(req, res) {
	res.json(db.getRegionsDB());
});

app.get("/devices", function(req, res) {
	res.json(db.getDevicesDB());
});


app.listen(appPort, localAddr, function () {
	console.log("Scalar time series app listening on port " + appPort);
});
