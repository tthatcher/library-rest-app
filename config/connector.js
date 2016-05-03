"use strict";
var orm = require('orm');
var logger = require('./logger');
var config = require('./config');
var async = require('async');

module.exports.connect = function (app) {
	logger.info('Connecting with info', config.postgres.conString);
	async.waterfall([
			function (callback) {
				app.use(orm.express(config.postgres.conString, {
						define : function (db, models) {
							db.load("../app/model/index", function (err) {
								if (!err) {
									Object.keys(db.models).forEach(x => models[x] = db.models[x]);
								}
								callback(err, db);
							});
						}
					}));
			},
			function (db, callback) {
				db.sync(function (err) {
					callback(err);
				});
			}
		], function (err) {
		if (err)
			throw err;
	});
};
