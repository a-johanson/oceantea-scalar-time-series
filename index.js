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

app.get("/convert", auth, require("./convert").convertHandler);

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
