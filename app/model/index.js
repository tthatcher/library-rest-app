"use strict";
module.exports = function (db, cb) {
	db.load('./models', function (err) {
		cb(err);
	});
};
