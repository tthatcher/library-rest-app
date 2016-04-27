"use strict";
var orm = require('orm');
var logger = require('./logger');
var config = require('./config');

function connectionInfo(opts) {
	var clone = Object.assign({}, opts);
	clone.password = '***';
	return clone;
}

//TODO Add indexes
//TODO Move off of orm
//TODO Constraints/validations
module.exports.connect = function(app) {
	logger.info('Connecting with info', connectionInfo(config.postgres.conString));
	app.use(orm.express(config.postgres.conString, {
		define: function (db, models, next) {
			db.load("../app/model/index", function (error) {
				if(error) {
					throw error;
				}
				Object.keys(db.models).forEach(x => models[x] = db.models[x]);
				db.sync();
			});
			next();
		}
	}));
};