module.exports = function(req, res, next) {
	if(req.headers.hasOwnProperty("x-auth-userid") && parseFloat(req.headers["x-auth-userid"]) >= 0) {
		return next();
	}
	return res.status(403).send("Forbidden");
};
